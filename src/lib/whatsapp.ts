import type { OrderDoc } from "@/lib/order-types";

const BRAND = "Indira Naturals";

export function inr(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

export function whatsappDigits(phone: string): string {
  const d = phone.replace(/\D/g, "");
  return d.length === 10 ? `91${d}` : d;
}

export function waLink(phone: string, text: string): string {
  return `https://wa.me/${whatsappDigits(phone)}?text=${encodeURIComponent(text)}`;
}

export function formatIST(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

function addressText(o: OrderDoc): string {
  return [o.addressLine1, o.addressLine2, `${o.city}, ${o.state} - ${o.pincode}`].filter(Boolean).join("\n");
}

function itemLines(o: OrderDoc): string {
  return o.items
    .map((i, n) => `${n + 1}. ${i.productName} (${i.variantLabel}) × ${i.quantity} — ${inr(i.lineTotal)}`)
    .join("\n");
}

function totals(o: OrderDoc): string {
  const rows = [`Subtotal: ${inr(o.subtotal)}`];
  if (o.discount > 0) rows.push(`Discount${o.couponCode ? ` (${o.couponCode})` : ""}: -${inr(o.discount)}`);
  rows.push(`Delivery: ${o.shipping === 0 ? "FREE" : inr(o.shipping)}`);
  return rows.join("\n");
}

function trackingBlock(o: OrderDoc, trackUrl: string): string {
  const lines: string[] = [];
  lines.push(
    `🚚 *Tracking Number:* ${o.trackingNumber ? o.trackingNumber : "Will be shared once your order ships"}`,
  );
  if (o.courierName) lines.push(`📦 *Courier:* ${o.courierName}`);
  if (o.trackingUrl) lines.push(`🔗 *Courier tracking:* ${o.trackingUrl}`);
  lines.push(`🔗 *Track your order:* ${trackUrl}`);
  return lines.join("\n");
}

/** Message the CUSTOMER sends to the shop's WhatsApp right after placing the order. */
export function buildOrderMessage(o: OrderDoc, trackUrl: string): string {
  const pay = o.paymentStatus === "paid" ? "Paid" : `Cash on Delivery — pay ${inr(o.total)} at delivery`;
  return [
    `🌿 *New Order — ${BRAND}*`,
    ``,
    `🧾 *Order ID:* ${o.orderNumber}`,
    `📅 *Date:* ${formatIST(o.createdAt)}`,
    ``,
    `👤 *Name:* ${o.customerName}`,
    `📞 *Phone:* ${o.phone}`,
    `📧 *Email:* ${o.email}`,
    `📍 *Delivery address:*`,
    addressText(o),
    o.deliveryInstructions ? `📝 *Note:* ${o.deliveryInstructions}` : "",
    ``,
    `🛒 *Products*`,
    itemLines(o),
    ``,
    totals(o),
    `💰 *Total Amount: ${inr(o.total)}*`,
    `💳 *Payment:* ${pay}`,
    ``,
    trackingBlock(o, trackUrl),
    ``,
    `Please confirm my order. Thank you! 🙏`,
  ]
    .filter((l, i, a) => !(l === "" && a[i - 1] === ""))
    .join("\n");
}

const HEAD: Record<string, string> = {
  pending: "We have received your order 🌿",
  confirmed: "Your order is confirmed ✅",
  processing: "Your order is being packed 📦",
  shipped: "Your order has been shipped 🚚",
  delivered: "Your order was delivered 🎉",
  cancelled: "Your order has been cancelled ❌",
};

/** Message the SHOP sends to the customer from the admin dashboard (status update). */
export function buildCustomerUpdate(o: OrderDoc, trackUrl: string): string {
  const due = o.paymentStatus === "paid" ? "" : `💰 *Amount to pay on delivery (COD):* ${inr(o.total)}`;
  const tail: Record<string, string> = {
    pending: "We will confirm it shortly.",
    confirmed: "We will pack and dispatch it soon.",
    processing: "It will be dispatched shortly.",
    shipped: "It should reach you soon. Please keep the cash ready.",
    delivered: "Thank you for choosing Indira Naturals! We would love your review on our website. 🙏",
    cancelled: "If this was a mistake, please reply to this message.",
  };
  return [
    `Hello ${o.customerName},`,
    HEAD[o.status] ?? "Order update",
    ``,
    `🧾 *Order ID:* ${o.orderNumber}`,
    `🛒 *Products*`,
    itemLines(o),
    ``,
    totals(o),
    `💰 *Total:* ${inr(o.total)}`,
    o.status !== "cancelled" && o.status !== "delivered" ? due : "",
    ``,
    o.status !== "cancelled" ? trackingBlock(o, trackUrl) : "",
    ``,
    tail[o.status] ?? "",
    `— ${BRAND}`,
  ]
    .filter((l, i, a) => !(l === "" && a[i - 1] === ""))
    .join("\n");
}
