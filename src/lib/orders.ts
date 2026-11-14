import "server-only";

import { FieldValue, type DocumentData, type Transaction } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import {
  COLLECTIONS,
  bust,
  isReserved,
  listProducts,
  listCoupons,
  listCustomers,
  listMessages,
  listReviews,
  normalizeCoupon,
  nowIso,
  toIso,
  type ProductDoc,
} from "@/lib/indira-firestore";
import { computeDiscount, computeShipping } from "@/lib/pricing";
import type { CheckoutInput } from "@/lib/validation";
import type {
  OrderDoc,
  OrderItemDoc,
  OrderStatus,
  PaymentStatus,
  SiteSettings,
} from "@/lib/order-types";

export class OrderError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

function generateOrderNumber(): string {
  // India time so the date in the order id matches the shop's day.
  const ist = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10).replace(/-/g, "");
  return `IN-${ist}-${Math.floor(1000 + Math.random() * 9000)}`;
}

export function normalizeOrder(id: string, d: DocumentData): OrderDoc {
  return {
    orderNumber: String(d.orderNumber ?? id),
    customerName: String(d.customerName ?? ""),
    email: String(d.email ?? ""),
    phone: String(d.phone ?? ""),
    addressLine1: String(d.addressLine1 ?? ""),
    addressLine2: String(d.addressLine2 ?? ""),
    city: String(d.city ?? ""),
    state: String(d.state ?? ""),
    pincode: String(d.pincode ?? ""),
    deliveryInstructions: String(d.deliveryInstructions ?? ""),
    items: Array.isArray(d.items) ? d.items : [],
    subtotal: Number(d.subtotal ?? 0),
    discount: Number(d.discount ?? 0),
    shipping: Number(d.shipping ?? 0),
    total: Number(d.total ?? 0),
    couponCode: d.couponCode ?? null,
    paymentMethod: d.paymentMethod === "razorpay" ? "razorpay" : "cod",
    paymentStatus: (d.paymentStatus ?? "pending") as PaymentStatus,
    status: (d.status ?? "pending") as OrderStatus,
    trackingNumber: d.trackingNumber ?? null,
    courierName: String(d.courierName ?? ""),
    trackingUrl: String(d.trackingUrl ?? ""),
    adminNote: String(d.adminNote ?? ""),
    statusHistory: Array.isArray(d.statusHistory) ? d.statusHistory : [],
    stockRestored: Boolean(d.stockRestored),
    createdAt: toIso(d.createdAt),
    updatedAt: toIso(d.updatedAt),
  };
}

export async function getOrder(orderNumber: string): Promise<OrderDoc | null> {
  if (isReserved(orderNumber)) return null;
  const snap = await getAdminDb().collection(COLLECTIONS.orders).doc(orderNumber).get();
  return snap.exists ? normalizeOrder(snap.id, snap.data()!) : null;
}

export async function listOrders(limit = 3000): Promise<OrderDoc[]> {
  const snap = await getAdminDb().collection(COLLECTIONS.orders).orderBy("createdAt", "desc").limit(limit).get();
  return snap.docs.filter((d) => !isReserved(d.id)).map((d) => normalizeOrder(d.id, d.data()));
}

// ---------------------------------------------------------------- place order
export async function placeOrder(input: CheckoutInput, settings: SiteSettings): Promise<OrderDoc> {
  const db = getAdminDb();
  const catalogue = await listProducts();

  // merge duplicate variants in the cart
  const wanted = new Map<number, number>();
  for (const it of input.items) wanted.set(it.variantId, (wanted.get(it.variantId) ?? 0) + it.quantity);

  const productIds = new Set<number>();
  for (const variantId of wanted.keys()) {
    const p = catalogue.find((x) => x.status === "published" && x.variants.some((v) => v.id === variantId));
    if (!p) throw new OrderError("One or more items are no longer available");
    productIds.add(p.id);
  }

  const couponCode = input.couponCode ? input.couponCode.toUpperCase() : "";

  for (let attempt = 0; attempt < 5; attempt++) {
    const orderNumber = generateOrderNumber();
    try {
      const order = await db.runTransaction(async (tx) => {
        const pRefs = [...productIds].map((id) => db.collection(COLLECTIONS.products).doc(String(id)));
        const pSnaps = await tx.getAll(...pRefs);
        const couponRef = couponCode ? db.collection(COLLECTIONS.coupons).doc(couponCode) : null;
        const couponSnap = couponRef ? await tx.get(couponRef) : null;
        const customerRef = db.collection(COLLECTIONS.customers).doc(input.phone);
        const customerSnap = await tx.get(customerRef);
        const orderRef = db.collection(COLLECTIONS.orders).doc(orderNumber);
        if ((await tx.get(orderRef)).exists) throw new OrderError("collision", 409);

        const products = new Map<number, DocumentData>();
        pSnaps.forEach((s) => s.exists && products.set(Number(s.data()!.id), s.data()!));

        const items: OrderItemDoc[] = [];
        const updatedVariants = new Map<number, DocumentData[]>();
        for (const [variantId, quantity] of wanted) {
          const pd = [...products.values()].find((p) => (p.variants ?? []).some((v: DocumentData) => v.id === variantId));
          if (!pd || pd.status === "draft") throw new OrderError("One or more items are no longer available");
          const variants = updatedVariants.get(pd.id) ?? (pd.variants as DocumentData[]).map((v) => ({ ...v }));
          const v = variants.find((x) => x.id === variantId)!;
          if (quantity > Number(v.stock ?? 0)) {
            throw new OrderError(
              Number(v.stock) > 0
                ? `Only ${v.stock} unit(s) of ${pd.name} (${v.label}) are in stock`
                : `${pd.name} (${v.label}) is out of stock`,
            );
          }
          v.stock = Number(v.stock) - quantity;
          updatedVariants.set(pd.id, variants);
          const unitPrice = Number(v.price);
          items.push({
            productId: Number(pd.id),
            variantId,
            productName: pd.name,
            productSlug: pd.slug,
            productImage: pd.image,
            variantLabel: v.label,
            unitPrice,
            quantity,
            lineTotal: unitPrice * quantity,
          });
        }

        const subtotal = items.reduce((s, l) => s + l.lineTotal, 0);

        let coupon = null;
        if (couponCode) {
          if (!couponSnap?.exists) throw new OrderError("Invalid coupon code");
          coupon = normalizeCoupon(couponSnap.data()!);
        }
        const discount = computeDiscount(coupon, subtotal);
        if (couponCode && discount === 0) throw new OrderError("This coupon is not valid for your order");

        const shipping = computeShipping(
          subtotal - discount,
          settings.freeShippingThreshold,
          settings.flatShippingRate,
        );
        const total = Math.max(0, subtotal - discount + shipping);
        const iso = nowIso();

        const doc: OrderDoc = {
          orderNumber,
          customerName: input.customerName,
          email: input.email.toLowerCase(),
          phone: input.phone,
          addressLine1: input.addressLine1,
          addressLine2: input.addressLine2 || "",
          city: input.city,
          state: input.state,
          pincode: input.pincode,
          deliveryInstructions: input.deliveryInstructions || "",
          items,
          subtotal,
          discount,
          shipping,
          total,
          couponCode: coupon ? coupon.code : null,
          paymentMethod: "cod",
          paymentStatus: "pending",
          status: "pending",
          trackingNumber: null,
          courierName: "",
          trackingUrl: "",
          adminNote: "",
          statusHistory: [{ status: "pending", note: "Order placed on website", at: iso }],
          stockRestored: false,
          createdAt: iso,
          updatedAt: iso,
        };

        // ---- writes (all reads are done above) ----
        for (const [pid, variants] of updatedVariants) {
          tx.update(db.collection(COLLECTIONS.products).doc(String(pid)), { variants, updatedAt: iso });
        }
        if (coupon && couponRef) tx.update(couponRef, { usedCount: FieldValue.increment(1) });
        tx.set(orderRef, doc);
        tx.set(
          customerRef,
          {
            phone: input.phone,
            name: input.customerName,
            email: input.email.toLowerCase(),
            addressLine1: input.addressLine1,
            addressLine2: input.addressLine2 || "",
            city: input.city,
            state: input.state,
            pincode: input.pincode,
            ordersCount: FieldValue.increment(1),
            totalSpent: FieldValue.increment(total),
            lastOrderAt: iso,
            lastOrderNumber: orderNumber,
            ...(customerSnap.exists ? {} : { firstOrderAt: iso }),
          },
          { merge: true },
        );
        return doc;
      });
      bust();
      return order;
    } catch (err) {
      if (err instanceof OrderError && err.status === 409) continue; // order-number collision, retry
      throw err;
    }
  }
  throw new OrderError("Could not generate an order number. Please try again.", 500);
}

// ---------------------------------------------------------------- stock restore
async function prepareRestore(tx: Transaction, order: OrderDoc) {
  const db = getAdminDb();
  const ids = [...new Set(order.items.map((i) => i.productId))];
  const refs = ids.map((id) => db.collection(COLLECTIONS.products).doc(String(id)));
  const snaps = refs.length ? await tx.getAll(...refs) : [];
  const custRef = db.collection(COLLECTIONS.customers).doc(order.phone);
  const custSnap = await tx.get(custRef);
  return () => {
    for (const snap of snaps) {
      if (!snap.exists) continue;
      const pid = Number(snap.data()!.id);
      const variants = (snap.data()!.variants as DocumentData[]).map((v) => {
        const back = order.items.filter((i) => i.productId === pid && i.variantId === v.id).reduce((s, i) => s + i.quantity, 0);
        return back ? { ...v, stock: Number(v.stock ?? 0) + back } : v;
      });
      tx.update(snap.ref, { variants, updatedAt: nowIso() });
    }
    if (custSnap.exists) {
      tx.update(custRef, {
        ordersCount: FieldValue.increment(-1),
        totalSpent: FieldValue.increment(-order.total),
      });
    }
  };
}

// ---------------------------------------------------------------- admin update
export type OrderPatch = {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  trackingNumber?: string | null;
  courierName?: string;
  trackingUrl?: string;
  adminNote?: string;
  note?: string;
};

export async function updateOrder(orderNumber: string, patch: OrderPatch, by: string): Promise<OrderDoc> {
  const db = getAdminDb();
  const ref = db.collection(COLLECTIONS.orders).doc(orderNumber);
  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists || isReserved(orderNumber)) throw new OrderError("Order not found", 404);
    const order = normalizeOrder(snap.id, snap.data()!);

    if (order.status === "cancelled" && patch.status && patch.status !== "cancelled") {
      throw new OrderError("A cancelled order cannot be reopened. Ask the customer to place a new order.");
    }

    const cancelling = patch.status === "cancelled" && order.status !== "cancelled";
    const restore = cancelling && !order.stockRestored ? await prepareRestore(tx, order) : null;

    const next: OrderDoc = { ...order, updatedAt: nowIso() };
    if (patch.trackingNumber !== undefined) next.trackingNumber = patch.trackingNumber || null;
    if (patch.courierName !== undefined) next.courierName = patch.courierName;
    if (patch.trackingUrl !== undefined) next.trackingUrl = patch.trackingUrl;
    if (patch.adminNote !== undefined) next.adminNote = patch.adminNote;
    if (patch.paymentStatus) next.paymentStatus = patch.paymentStatus;

    if (patch.status && patch.status !== order.status) {
      next.status = patch.status;
      next.statusHistory = [
        ...order.statusHistory,
        { status: patch.status, note: patch.note || "", at: next.updatedAt, by },
      ];
      // Cash on Delivery: the cash is collected when the order is delivered.
      if (patch.status === "delivered" && order.paymentMethod === "cod" && !patch.paymentStatus) {
        next.paymentStatus = "paid";
      }
      if (cancelling) next.stockRestored = true;
    }

    if (restore) restore();
    tx.set(ref, next);
    return next;
  });
  bust();
  return result;
}

export async function deleteOrder(orderNumber: string) {
  const db = getAdminDb();
  const ref = db.collection(COLLECTIONS.orders).doc(orderNumber);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const order = normalizeOrder(snap.id, snap.data()!);
    const restore = order.status !== "cancelled" && !order.stockRestored ? await prepareRestore(tx, order) : null;
    if (restore) restore();
    tx.delete(ref);
  });
  bust();
}

// ---------------------------------------------------------------- dashboard stats
const istKey = (iso: string) => new Date(new Date(iso).getTime() + 5.5 * 3600_000).toISOString();

export async function getDashboardStats() {
  const [orders, products, coupons, customers, messages, reviews] = await Promise.all([
    listOrders(),
    listProducts(),
    listCoupons(),
    listCustomers(),
    listMessages(),
    listReviews("pending"),
  ]);

  const live = orders.filter((o) => o.status !== "cancelled");
  const sum = (list: OrderDoc[]) => list.reduce((s, o) => s + o.total, 0);
  const today = istKey(nowIso()).slice(0, 10);
  const month = today.slice(0, 7);

  const ordersByStatus: Record<string, number> = {};
  for (const o of orders) ordersByStatus[o.status] = (ordersByStatus[o.status] ?? 0) + 1;

  const dayBucket = (key: string, list: OrderDoc[]) => ({
    key,
    orders: list.length,
    revenue: sum(list.filter((o) => o.status !== "cancelled")),
    pending: list.filter((o) => o.status === "pending").length,
    delivered: list.filter((o) => o.status === "delivered").length,
    cancelled: list.filter((o) => o.status === "cancelled").length,
  });

  const daily = [];
  for (let i = 29; i >= 0; i--) {
    const key = istKey(new Date(Date.now() - i * 86400_000).toISOString()).slice(0, 10);
    daily.push(dayBucket(key, orders.filter((o) => istKey(o.createdAt).slice(0, 10) === key)));
  }
  const monthly = [];
  const base = new Date(`${month}-01T00:00:00Z`);
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - i, 1));
    const key = d.toISOString().slice(0, 7);
    monthly.push(dayBucket(key, orders.filter((o) => istKey(o.createdAt).slice(0, 7) === key)));
  }

  const lowStock: { productName: string; variantLabel: string; stock: number; productId: number }[] = [];
  let outOfStockVariants = 0;
  for (const p of products) {
    for (const v of p.variants) {
      if (v.stock === 0) outOfStockVariants++;
      if (v.stock <= 10) lowStock.push({ productId: p.id, productName: p.name, variantLabel: v.label, stock: v.stock });
    }
  }

  return {
    totalOrders: orders.length,
    totalRevenue: sum(live),
    deliveredRevenue: sum(orders.filter((o) => o.status === "delivered")),
    pendingOrders: ordersByStatus.pending ?? 0,
    ordersByStatus,
    todayOrders: orders.filter((o) => istKey(o.createdAt).slice(0, 10) === today).length,
    todayRevenue: sum(live.filter((o) => istKey(o.createdAt).slice(0, 10) === today)),
    monthOrders: orders.filter((o) => istKey(o.createdAt).slice(0, 7) === month).length,
    monthRevenue: sum(live.filter((o) => istKey(o.createdAt).slice(0, 7) === month)),
    codToCollect: sum(orders.filter((o) => o.status === "shipped" && o.paymentStatus !== "paid")),
    productCount: products.length,
    outOfStockVariants,
    lowStock: lowStock.sort((a, b) => a.stock - b.stock).slice(0, 12),
    couponCount: coupons.length,
    customerCount: customers.length,
    pendingReviewCount: reviews.length,
    newMessageCount: messages.filter((m) => m.status === "new").length,
    daily,
    monthly,
  };
}

export type { ProductDoc };
