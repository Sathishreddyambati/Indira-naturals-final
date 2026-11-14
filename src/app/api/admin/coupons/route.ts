import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { adminCouponSchema } from "@/lib/validation";
import { ConflictError, createCoupon, listCoupons } from "@/lib/indira-firestore";

export const dynamic = "force-dynamic";

export async function GET() {
  const { session, response } = await requireAdmin();
  if (!session) return response;
  return NextResponse.json(await listCoupons());
}

export async function POST(req: Request) {
  const { session, response } = await requireAdmin();
  if (!session) return response;
  const parsed = adminCouponSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid coupon data" }, { status: 400 });
  }
  try {
    await createCoupon(parsed.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ConflictError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
