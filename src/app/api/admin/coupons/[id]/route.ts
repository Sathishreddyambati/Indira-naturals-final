import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { adminCouponSchema } from "@/lib/validation";
import { ConflictError, deleteCoupon, updateCoupon } from "@/lib/indira-firestore";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

// `id` is the coupon code.
export async function PUT(req: Request, { params }: Ctx) {
  const { session, response } = await requireAdmin();
  if (!session) return response;
  const parsed = adminCouponSchema.partial().safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid coupon data" }, { status: 400 });
  try {
    const ok = await updateCoupon(decodeURIComponent((await params).id), parsed.data);
    if (!ok) return NextResponse.json({ error: "Coupon not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ConflictError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { session, response } = await requireAdmin();
  if (!session) return response;
  await deleteCoupon(decodeURIComponent((await params).id));
  return NextResponse.json({ ok: true });
}
