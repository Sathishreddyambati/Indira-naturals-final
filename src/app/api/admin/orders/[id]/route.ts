import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { adminOrderUpdateSchema } from "@/lib/validation";
import { OrderError, deleteOrder, getOrder, updateOrder } from "@/lib/orders";
import { buildTrackUrl, getSiteUrl } from "@/lib/order-link";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const { session, response } = await requireAdmin();
  if (!session) return response;
  const { id } = await params;
  const order = await getOrder(decodeURIComponent(id));
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  return NextResponse.json({ ...order, trackUrl: buildTrackUrl(getSiteUrl(req), order.orderNumber) });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { session, response } = await requireAdmin();
  if (!session) return response;
  const { id } = await params;
  const parsed = adminOrderUpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid update payload" }, { status: 400 });
  try {
    const order = await updateOrder(decodeURIComponent(id), parsed.data, session.email);
    return NextResponse.json({ ok: true, order: { ...order, trackUrl: buildTrackUrl(getSiteUrl(req), order.orderNumber) } });
  } catch (err) {
    if (err instanceof OrderError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error(err);
    return NextResponse.json({ error: "Could not update order" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { session, response } = await requireAdmin();
  if (!session) return response;
  const { id } = await params;
  await deleteOrder(decodeURIComponent(id));
  return NextResponse.json({ ok: true });
}
