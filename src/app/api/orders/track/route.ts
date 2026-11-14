import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { getOrder } from "@/lib/orders";

export const dynamic = "force-dynamic";

const schema = z.object({
  orderNumber: z.string().trim().min(3),
  email: z.string().trim().email(),
});

export async function POST(req: Request) {
  const ip = getClientIp(req);
  if (!rateLimit(`track:${ip}`, 15, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests. Please try again shortly." }, { status: 429 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Please provide a valid order number and email" }, { status: 400 });
  }
  const order = await getOrder(parsed.data.orderNumber.toUpperCase());
  if (!order || order.email.toLowerCase() !== parsed.data.email.toLowerCase()) {
    return NextResponse.json({ error: "No matching order found. Check your order number and email." }, { status: 404 });
  }
  return NextResponse.json({
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    trackingNumber: order.trackingNumber,
    subtotal: order.subtotal.toFixed(2),
    discount: order.discount.toFixed(2),
    shipping: order.shipping.toFixed(2),
    total: order.total.toFixed(2),
    createdAt: order.createdAt,
    items: order.items.map((i) => ({
      productName: i.productName,
      variantLabel: i.variantLabel,
      quantity: i.quantity,
      lineTotal: i.lineTotal.toFixed(2),
      productImage: i.productImage,
    })),
  });
}
