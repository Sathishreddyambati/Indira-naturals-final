import "server-only";

import { FieldValue, type DocumentData } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import type { CouponDoc, SiteSettings } from "@/lib/order-types";
import type { z } from "zod";
import type { adminProductSchema, adminSettingsSchema, adminCouponSchema } from "@/lib/validation";
import { seedProducts } from "@/lib/seed-data";

export const COLLECTIONS = {
  products: "indira_products",
  orders: "indira_orders",
  customers: "indira_customers",
  coupons: "indira_coupons",
  settings: "indira_settings",
  admins: "indira_admins",
  reviews: "indira_reviews",
  messages: "indira_messages",
  newsletter: "indira_newsletter",
  counters: "indira_counters",
} as const;

// Placeholder docs created in the Firebase console (e.g. "setup") are never real data.
export const isReserved = (id: string) => id === "setup";
export const nowIso = () => new Date().toISOString();

export function toIso(v: unknown): string {
  if (!v) return nowIso();
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object" && v !== null && "toDate" in v && typeof (v as { toDate: unknown }).toDate === "function") {
    return (v as { toDate: () => Date }).toDate().toISOString();
  }
  return nowIso();
}

// ---------- tiny in-memory cache (per serverless instance) ----------
const cache = new Map<string, { at: number; value: unknown }>();
const TTL_MS = 20_000;
export async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as T;
  const value = await load();
  cache.set(key, { at: Date.now(), value });
  return value;
}
export function bust() {
  cache.clear();
}

// ---------- ids ----------
/** Reserves `count` sequential numeric ids and returns the first one. */
export async function allocateIds(name: string, count = 1): Promise<number> {
  const db = getAdminDb();
  const ref = db.collection(COLLECTIONS.counters).doc(name);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists ? Number(snap.data()?.value ?? 0) : 0;
    tx.set(ref, { value: current + count });
    return current + 1;
  });
}

// ================= PRODUCTS =================
export type VariantDoc = {
  id: number;
  label: string;
  weightGrams: number;
  sku: string;
  price: number;
  comparePrice: number | null;
  stock: number;
  isDefault: boolean;
  sortOrder: number;
};

export type ProductDoc = {
  id: number;
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  category: string;
  image: string;
  galleryImages: string[];
  ingredients: string;
  netWeightLabel: string;
  usageInstructions: string;
  storageInstructions: string;
  allergenInfo: string | null;
  skuPrefix: string;
  status: string;
  featured: boolean;
  bestseller: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  avgRating: number;
  reviewCount: number;
  variants: VariantDoc[];
  createdAt: string;
  updatedAt: string;
};

function normalizeProduct(d: DocumentData): ProductDoc {
  const variants: VariantDoc[] = (Array.isArray(d.variants) ? d.variants : [])
    .map((v: DocumentData, i: number) => ({
      id: Number(v.id),
      label: String(v.label ?? ""),
      weightGrams: Number(v.weightGrams ?? 0),
      sku: String(v.sku ?? ""),
      price: Number(v.price ?? 0),
      comparePrice: v.comparePrice != null ? Number(v.comparePrice) : null,
      stock: Number(v.stock ?? 0),
      isDefault: Boolean(v.isDefault),
      sortOrder: Number(v.sortOrder ?? i),
    }))
    .sort((a: VariantDoc, b: VariantDoc) => a.sortOrder - b.sortOrder);
  return {
    id: Number(d.id),
    slug: String(d.slug ?? ""),
    name: String(d.name ?? ""),
    shortDescription: String(d.shortDescription ?? ""),
    description: String(d.description ?? ""),
    category: String(d.category ?? ""),
    image: String(d.image ?? ""),
    galleryImages: Array.isArray(d.galleryImages) ? d.galleryImages : [],
    ingredients: String(d.ingredients ?? ""),
    netWeightLabel: String(d.netWeightLabel ?? ""),
    usageInstructions: String(d.usageInstructions ?? ""),
    storageInstructions: String(d.storageInstructions ?? ""),
    allergenInfo: d.allergenInfo ?? null,
    skuPrefix: String(d.skuPrefix ?? ""),
    status: String(d.status ?? "published"),
    featured: Boolean(d.featured),
    bestseller: Boolean(d.bestseller),
    seoTitle: d.seoTitle ?? null,
    seoDescription: d.seoDescription ?? null,
    avgRating: Number(d.avgRating ?? 0),
    reviewCount: Number(d.reviewCount ?? 0),
    variants,
    createdAt: toIso(d.createdAt),
    updatedAt: toIso(d.updatedAt),
  };
}

export async function listProducts(): Promise<ProductDoc[]> {
  const snap = await getAdminDb().collection(COLLECTIONS.products).get();
  return snap.docs
    .filter((d) => !isReserved(d.id) && typeof d.data().id === "number")
    .map((d) => normalizeProduct(d.data()))
    .sort((a, b) => a.id - b.id);
}

export const listProductsCached = () => cached("products", listProducts);

export async function getProductById(id: number): Promise<ProductDoc | null> {
  const snap = await getAdminDb().collection(COLLECTIONS.products).doc(String(id)).get();
  return snap.exists ? normalizeProduct(snap.data()!) : null;
}

type ProductInput = z.infer<typeof adminProductSchema>;

async function buildVariants(input: ProductInput, existing: VariantDoc[]): Promise<VariantDoc[]> {
  const existingIds = new Set(existing.map((v) => v.id));
  const fresh = input.variants.filter((v) => !v.id || !existingIds.has(v.id)).length;
  let nextId = fresh > 0 ? await allocateIds("variants", fresh) : 0;
  const skus = new Set<string>();
  return input.variants.map((v, i) => {
    if (skus.has(v.sku)) throw new Error(`Duplicate SKU "${v.sku}"`);
    skus.add(v.sku);
    const id = v.id && existingIds.has(v.id) ? v.id : nextId++;
    return {
      id,
      label: v.label,
      weightGrams: v.weightGrams,
      sku: v.sku,
      price: v.price,
      comparePrice: v.comparePrice ? v.comparePrice : null,
      stock: v.stock,
      isDefault: v.isDefault ?? i === 0,
      sortOrder: i,
    };
  });
}

function productFields(input: ProductInput) {
  return {
    slug: input.slug,
    name: input.name,
    shortDescription: input.shortDescription,
    description: input.description,
    category: input.category,
    image: input.image,
    galleryImages: input.galleryImages ?? [],
    ingredients: input.ingredients,
    netWeightLabel: input.netWeightLabel,
    usageInstructions: input.usageInstructions,
    storageInstructions: input.storageInstructions,
    allergenInfo: input.allergenInfo || null,
    skuPrefix: input.skuPrefix,
    status: input.status,
    featured: input.featured,
    bestseller: input.bestseller,
    seoTitle: input.seoTitle || null,
    seoDescription: input.seoDescription || null,
  };
}

export class ConflictError extends Error {}

export async function createProduct(input: ProductInput): Promise<number> {
  const all = await listProducts();
  if (all.some((p) => p.slug === input.slug)) throw new ConflictError("A product with this slug already exists");
  const id = await allocateIds("products");
  const variants = await buildVariants(input, []);
  const iso = nowIso();
  await getAdminDb()
    .collection(COLLECTIONS.products)
    .doc(String(id))
    .set({ id, ...productFields(input), avgRating: 0, reviewCount: 0, variants, createdAt: iso, updatedAt: iso });
  bust();
  return id;
}

export async function updateProduct(id: number, input: ProductInput): Promise<boolean> {
  const all = await listProducts();
  const current = all.find((p) => p.id === id);
  if (!current) return false;
  if (all.some((p) => p.slug === input.slug && p.id !== id))
    throw new ConflictError("Another product already uses this slug");
  const variants = await buildVariants(input, current.variants);
  await getAdminDb()
    .collection(COLLECTIONS.products)
    .doc(String(id))
    .set({ ...productFields(input), variants, updatedAt: nowIso() }, { merge: true });
  bust();
  return true;
}

export async function deleteProduct(id: number) {
  await getAdminDb().collection(COLLECTIONS.products).doc(String(id)).delete();
  bust();
}

export async function setStock(
  productId: number,
  change: { variantId: number; stock: number } | { outOfStock: true },
): Promise<boolean> {
  const db = getAdminDb();
  const ref = db.collection(COLLECTIONS.products).doc(String(productId));
  const ok = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return false;
    const p = normalizeProduct(snap.data()!);
    const variants = p.variants.map((v) =>
      "outOfStock" in change ? { ...v, stock: 0 } : v.id === change.variantId ? { ...v, stock: change.stock } : v,
    );
    tx.update(ref, { variants, updatedAt: nowIso() });
    return true;
  });
  bust();
  return ok;
}

/** Loads the starter catalogue, settings and a welcome coupon. Only when no products exist. */
export async function seedStarterData(): Promise<{ created: number }> {
  const existing = await listProducts();
  if (existing.length > 0) return { created: 0 };
  let created = 0;
  for (const sp of seedProducts) {
    await createProduct({
      slug: sp.slug,
      name: sp.name,
      shortDescription: sp.shortDescription,
      description: sp.description,
      category: sp.category,
      image: sp.image,
      galleryImages: sp.gallery,
      ingredients: sp.ingredients,
      netWeightLabel: sp.netWeightLabel,
      usageInstructions: sp.usage,
      storageInstructions: sp.storage,
      allergenInfo: sp.allergen ?? "",
      skuPrefix: sp.skuPrefix,
      status: "published",
      featured: sp.featured,
      bestseller: sp.bestseller,
      seoTitle: `${sp.name} | Indira Naturals`,
      seoDescription: sp.shortDescription,
      variants: sp.variants.map((v, i) => ({
        label: v.label,
        weightGrams: v.grams,
        sku: `${sp.skuPrefix}-${v.label.replace(/\s+/g, "")}`,
        price: v.price,
        comparePrice: v.compare ?? null,
        stock: v.stock,
        isDefault: i === 0,
      })),
    });
    created++;
  }
  const db = getAdminDb();
  const settingsRef = db.collection(COLLECTIONS.settings).doc("store");
  if (!(await settingsRef.get()).exists) await settingsRef.set({ ...DEFAULT_SETTINGS, updatedAt: nowIso() });
  const couponRef = db.collection(COLLECTIONS.coupons).doc("WELCOME10");
  if (!(await couponRef.get()).exists) {
    await couponRef.set({
      code: "WELCOME10",
      type: "percent",
      value: 10,
      minOrderAmount: 299,
      active: true,
      usageLimit: null,
      usedCount: 0,
      expiresAt: null,
      createdAt: nowIso(),
    });
  }
  return { created };
}

// ================= SETTINGS =================
export const DEFAULT_SETTINGS: SiteSettings = {
  announcementText: "Pure • Fresh • Natural — order on WhatsApp, pay Cash on Delivery.",
  heroHeadline: "Nature's Goodness in Every Spoon",
  heroSubtext:
    "Ginger and garlic, ready when you are. 100% pure natural powders made only by drying — no preservatives, no additives.",
  heroCtaPrimaryLabel: "Shop Our Powders",
  heroCtaSecondaryLabel: "Our Story",
  freeShippingThreshold: 499,
  flatShippingRate: 59,
  codEnabled: true,
  onlinePaymentEnabled: false,
  supportEmail: "contact.indiranaturals@gmail.com",
  supportPhone: "+91 91771 66077",
  whatsappNumber: "919177166077",
  businessAddress: "Guntur, Andhra Pradesh, India",
  instagramUrl: null,
  facebookUrl: null,
  updatedAt: "",
};

export async function getSettings(): Promise<SiteSettings> {
  const snap = await getAdminDb().collection(COLLECTIONS.settings).doc("store").get();
  const d = snap.exists ? snap.data()! : {};
  const s = { ...DEFAULT_SETTINGS, ...d } as SiteSettings;
  return {
    ...s,
    freeShippingThreshold: Number(s.freeShippingThreshold),
    flatShippingRate: Number(s.flatShippingRate),
    updatedAt: d.updatedAt ? toIso(d.updatedAt) : "",
  };
}
export const getSettingsCached = () => cached("settings", getSettings);

export async function saveSettings(input: z.infer<typeof adminSettingsSchema>) {
  await getAdminDb()
    .collection(COLLECTIONS.settings)
    .doc("store")
    .set({
      ...input,
      instagramUrl: input.instagramUrl || null,
      facebookUrl: input.facebookUrl || null,
      updatedAt: nowIso(),
    });
  bust();
}

// ================= COUPONS =================
function normalizeCoupon(d: DocumentData): CouponDoc {
  return {
    code: String(d.code),
    type: d.type === "fixed" ? "fixed" : "percent",
    value: Number(d.value ?? 0),
    minOrderAmount: Number(d.minOrderAmount ?? 0),
    active: d.active !== false,
    usageLimit: d.usageLimit != null ? Number(d.usageLimit) : null,
    usedCount: Number(d.usedCount ?? 0),
    expiresAt: d.expiresAt ? toIso(d.expiresAt) : null,
    createdAt: toIso(d.createdAt),
  };
}
export { normalizeCoupon };

export async function listCoupons(): Promise<CouponDoc[]> {
  const snap = await getAdminDb().collection(COLLECTIONS.coupons).get();
  return snap.docs
    .filter((d) => !isReserved(d.id) && d.data().code)
    .map((d) => normalizeCoupon(d.data()))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

type CouponInput = z.infer<typeof adminCouponSchema>;

export async function createCoupon(input: CouponInput) {
  const code = input.code.toUpperCase();
  const ref = getAdminDb().collection(COLLECTIONS.coupons).doc(code);
  if ((await ref.get()).exists) throw new ConflictError("A coupon with this code already exists");
  await ref.set({
    code,
    type: input.type,
    value: input.value,
    minOrderAmount: input.minOrderAmount,
    active: input.active,
    usageLimit: input.usageLimit ?? null,
    usedCount: 0,
    expiresAt: input.expiresAt ? new Date(input.expiresAt).toISOString() : null,
    createdAt: nowIso(),
  });
}

export async function updateCoupon(code: string, patch: Partial<CouponInput>): Promise<boolean> {
  const col = getAdminDb().collection(COLLECTIONS.coupons);
  const ref = col.doc(code.toUpperCase());
  const snap = await ref.get();
  if (!snap.exists) return false;
  const next = { ...snap.data()! } as DocumentData;
  if (patch.type) next.type = patch.type;
  if (patch.value !== undefined) next.value = patch.value;
  if (patch.minOrderAmount !== undefined) next.minOrderAmount = patch.minOrderAmount;
  if (patch.active !== undefined) next.active = patch.active;
  if (patch.usageLimit !== undefined) next.usageLimit = patch.usageLimit ?? null;
  if (patch.expiresAt !== undefined) next.expiresAt = patch.expiresAt ? new Date(patch.expiresAt).toISOString() : null;
  const newCode = patch.code?.toUpperCase();
  if (newCode && newCode !== ref.id) {
    if ((await col.doc(newCode).get()).exists) throw new ConflictError("A coupon with this code already exists");
    next.code = newCode;
    await col.doc(newCode).set(next);
    await ref.delete();
  } else {
    await ref.set(next);
  }
  return true;
}

export async function deleteCoupon(code: string) {
  await getAdminDb().collection(COLLECTIONS.coupons).doc(code.toUpperCase()).delete();
}

// ================= REVIEWS =================
export type ReviewDoc = {
  id: string;
  productId: number;
  productName: string;
  customerName: string;
  rating: number;
  title: string | null;
  body: string;
  verifiedPurchase: boolean;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
};

function normalizeReview(id: string, d: DocumentData): ReviewDoc {
  return {
    id,
    productId: Number(d.productId),
    productName: String(d.productName ?? ""),
    customerName: String(d.customerName ?? ""),
    rating: Number(d.rating ?? 5),
    title: d.title ?? null,
    body: String(d.body ?? ""),
    verifiedPurchase: Boolean(d.verifiedPurchase),
    status: d.status ?? "pending",
    createdAt: toIso(d.createdAt),
  };
}

export async function listReviews(status?: ReviewDoc["status"]): Promise<ReviewDoc[]> {
  const col = getAdminDb().collection(COLLECTIONS.reviews);
  const snap = await (status ? col.where("status", "==", status) : col).get();
  return snap.docs
    .filter((d) => !isReserved(d.id))
    .map((d) => normalizeReview(d.id, d.data()))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listApprovedReviewsForProduct(productId: number): Promise<ReviewDoc[]> {
  const snap = await getAdminDb()
    .collection(COLLECTIONS.reviews)
    .where("productId", "==", productId)
    .where("status", "==", "approved")
    .get();
  return snap.docs
    .map((d) => normalizeReview(d.id, d.data()))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function addReview(input: {
  productId: number;
  customerName: string;
  rating: number;
  title?: string;
  body: string;
}): Promise<boolean> {
  const product = await getProductById(input.productId);
  if (!product) return false;
  await getAdminDb()
    .collection(COLLECTIONS.reviews)
    .add({
      productId: product.id,
      productName: product.name,
      customerName: input.customerName,
      rating: input.rating,
      title: input.title || null,
      body: input.body,
      verifiedPurchase: false,
      status: "pending",
      createdAt: nowIso(),
    });
  return true;
}

async function recomputeRating(productId: number) {
  const approved = await listApprovedReviewsForProduct(productId);
  const count = approved.length;
  const avg = count ? approved.reduce((s, r) => s + r.rating, 0) / count : 0;
  const ref = getAdminDb().collection(COLLECTIONS.products).doc(String(productId));
  if ((await ref.get()).exists) await ref.update({ avgRating: Math.round(avg * 100) / 100, reviewCount: count });
  bust();
}

export async function setReviewStatus(id: string, status: ReviewDoc["status"]): Promise<boolean> {
  const ref = getAdminDb().collection(COLLECTIONS.reviews).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return false;
  await ref.update({ status });
  await recomputeRating(Number(snap.data()!.productId));
  return true;
}

export async function removeReview(id: string) {
  const ref = getAdminDb().collection(COLLECTIONS.reviews).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return;
  await ref.delete();
  await recomputeRating(Number(snap.data()!.productId));
}

// ================= CONTACT / NEWSLETTER / CUSTOMERS =================
export type MessageDoc = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  status: "new" | "read" | "resolved";
  createdAt: string;
};

export async function addMessage(m: Omit<MessageDoc, "id" | "status" | "createdAt">) {
  await getAdminDb()
    .collection(COLLECTIONS.messages)
    .add({ ...m, phone: m.phone || null, status: "new", createdAt: nowIso() });
}

export async function listMessages(): Promise<MessageDoc[]> {
  const snap = await getAdminDb().collection(COLLECTIONS.messages).get();
  return snap.docs
    .filter((d) => !isReserved(d.id))
    .map((d) => ({ id: d.id, ...d.data(), createdAt: toIso(d.data().createdAt) }) as MessageDoc)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function setMessageStatus(id: string, status: MessageDoc["status"]) {
  await getAdminDb().collection(COLLECTIONS.messages).doc(id).update({ status });
}

export async function addSubscriber(email: string) {
  await getAdminDb()
    .collection(COLLECTIONS.newsletter)
    .doc(email.toLowerCase())
    .set({ email: email.toLowerCase(), createdAt: nowIso() }, { merge: true });
}

export async function listSubscribers(): Promise<{ email: string; createdAt: string }[]> {
  const snap = await getAdminDb().collection(COLLECTIONS.newsletter).get();
  return snap.docs
    .filter((d) => !isReserved(d.id))
    .map((d) => ({ email: String(d.data().email ?? d.id), createdAt: toIso(d.data().createdAt) }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export type CustomerDoc = {
  phone: string;
  name: string;
  email: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
  ordersCount: number;
  totalSpent: number;
  firstOrderAt: string;
  lastOrderAt: string;
};

export async function listCustomers(): Promise<CustomerDoc[]> {
  const snap = await getAdminDb().collection(COLLECTIONS.customers).get();
  return snap.docs
    .filter((d) => !isReserved(d.id) && d.data().phone)
    .map((d) => {
      const x = d.data();
      return {
        phone: String(x.phone),
        name: String(x.name ?? ""),
        email: String(x.email ?? ""),
        addressLine1: String(x.addressLine1 ?? ""),
        addressLine2: String(x.addressLine2 ?? ""),
        city: String(x.city ?? ""),
        state: String(x.state ?? ""),
        pincode: String(x.pincode ?? ""),
        ordersCount: Number(x.ordersCount ?? 0),
        totalSpent: Number(x.totalSpent ?? 0),
        firstOrderAt: toIso(x.firstOrderAt),
        lastOrderAt: toIso(x.lastOrderAt),
      };
    })
    .sort((a, b) => b.lastOrderAt.localeCompare(a.lastOrderAt));
}

export { FieldValue };
