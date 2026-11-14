import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getOrder } from "@/lib/orders";
import { verifyOrderKey } from "@/lib/order-link";
import { formatINR } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your Order", robots: { index: false, follow: false } };

const STEPS = ["pending", "confirmed", "processing", "shipped", "delivered"];

// Private tracking page opened from the WhatsApp link. The signed ?k= key replaces the email check.
export default async function TrackLinkPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<{ k?: string }>;
}) {
  const { orderNumber: raw } = await params;
  const { k } = await searchParams;
  const orderNumber = decodeURIComponent(raw);
  const order = verifyOrderKey(orderNumber, k) ? await getOrder(orderNumber) : null;

  if (!order) {
    return (
      <div className="container-site py-20 text-center">
        <h1 className="font-serif text-3xl text-brand-forest">Order not found</h1>
        <p className="mt-3 text-brand-charcoal/70">This tracking link is invalid. You can look up your order with your order number and email.</p>
        <Link href="/track-order" className="mt-6 inline-block rounded-full bg-brand-forest px-7 py-3 text-sm font-semibold text-brand-ivory">
          Track Order
        </Link>
      </div>
    );
  }

  const active = STEPS.indexOf(order.status);
  return (
    <div className="container-site py-12 lg:py-16">
      <div className="mx-auto max-w-2xl rounded-2xl border border-brand-brown/10 bg-white p-6 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-brown/10 pb-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-brand-charcoal/50">Order</p>
            <p className="font-serif text-xl text-brand-forest">{order.orderNumber}</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-brand-charcoal/50">Payment</p>
            <p className="font-medium capitalize">{order.paymentStatus} · COD</p>
          </div>
        </div>

        {order.status === "cancelled" ? (
          <p className="py-6 text-center font-medium text-red-600">This order has been cancelled.</p>
        ) : (
          <div className="flex items-center justify-between py-6">
            {STEPS.map((step, i) => (
              <div key={step} className="flex flex-1 flex-col items-center text-center">
                <div
                  className={`grid h-8 w-8 place-items-center rounded-full text-xs font-bold ${
                    i <= active ? "bg-brand-forest text-brand-ivory" : "bg-brand-cream text-brand-charcoal/40"
                  }`}
                >
                  {i + 1}
                </div>
                <p className="mt-2 text-[11px] capitalize text-brand-charcoal/60">{step}</p>
              </div>
            ))}
          </div>
        )}

        <p className="mb-4 rounded-lg bg-brand-cream p-3 text-sm">
          Tracking Number:{" "}
          <span className="font-semibold">{order.trackingNumber || "Will be shared once your order ships"}</span>
          {order.courierName && <span className="block text-xs text-brand-charcoal/60">Courier: {order.courierName}</span>}
          {order.trackingUrl && (
            <a href={order.trackingUrl} target="_blank" rel="noreferrer" className="mt-1 block text-xs font-semibold text-brand-forest underline">
              Track with courier
            </a>
          )}
        </p>

        <ul className="flex flex-col gap-3 border-t border-brand-brown/10 pt-4">
          {order.items.map((item, i) => (
            <li key={i} className="flex items-center gap-3">
              <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-brand-cream">
                <Image src={item.productImage} alt={item.productName} fill sizes="48px" className="object-cover" />
              </div>
              <div className="flex-1 text-sm">
                <p className="font-medium">{item.productName}</p>
                <p className="text-xs text-brand-charcoal/60">{item.variantLabel} × {item.quantity}</p>
              </div>
              <span className="text-sm font-semibold">{formatINR(item.lineTotal)}</span>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex justify-between border-t border-brand-brown/10 pt-4 font-serif text-lg font-semibold">
          <span>{order.paymentStatus === "paid" ? "Total Paid" : "Pay on Delivery"}</span>
          <span>{formatINR(order.total)}</span>
        </div>
      </div>
    </div>
  );
}
