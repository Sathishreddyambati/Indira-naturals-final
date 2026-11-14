import { NextResponse } from "next/server";
import { checkoutSchema } from "@/lib/validation";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { getSettings } from "@/lib/indira-firestore";
import { OrderError, placeOrder } from "@/lib/orders";
import { buildTrackUrl, getSiteUrl } from "@/lib/order-link";
import { buildOrderMessage, waLink } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

// Cash-on-Delivery order placed through the website, completed on WhatsApp.
export async function POST(req: Request) {
  const ip = getClientIp(req);
  if (!rateLimit(`checkout:${ip}`, 10, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests. Please try again shortly." }, { status: 429 });
  }

  const parsed = checkoutSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid order data" }, { status: 400 });
  }
  const input = parsed.data;

  try {
    const settings = await getSettings();
    if (input.paymentMethod !== "cod") {
      return NextResponse.json(
        { error: "Online payment is not available. Please choose Cash on Delivery." },
        { status: 400 },
      );
    }
    if (!settings.codEnabled) {
      return NextResponse.json({ error: "Cash on Delivery is currently unavailable" }, { status: 400 });
    }

    const order = await placeOrder(input, settings);
    const trackUrl = buildTrackUrl(getSiteUrl(req), order.orderNumber);
    const whatsappUrl = waLink(settings.whatsappNumber, buildOrderMessage(order, trackUrl));

    return NextResponse.json({
      orderNumber: order.orderNumber,
      paymentMethod: "cod",
      total: order.total,
      trackUrl,
      whatsappUrl,
    });
  } catch (err) {
    if (err instanceof OrderError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Checkout failed", err);
    return NextResponse.json({ error: "Could not place your order. Please try again." }, { status: 500 });
  }
}
