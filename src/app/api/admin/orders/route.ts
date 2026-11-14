import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { listOrders } from "@/lib/orders";
import { buildTrackUrl, getSiteUrl } from "@/lib/order-link";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { session, response } = await requireAdmin();
  if (!session) return response;
  const base = getSiteUrl(req);
  const orders = await listOrders();
  return NextResponse.json(orders.map((o) => ({ ...o, trackUrl: buildTrackUrl(base, o.orderNumber) })));
}
