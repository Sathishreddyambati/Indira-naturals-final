import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { adminReviewUpdateSchema } from "@/lib/validation";
import { removeReview, setReviewStatus } from "@/lib/indira-firestore";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const { session, response } = await requireAdmin();
  if (!session) return response;
  const parsed = adminReviewUpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  const ok = await setReviewStatus((await params).id, parsed.data.status);
  if (!ok) return NextResponse.json({ error: "Review not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { session, response } = await requireAdmin();
  if (!session) return response;
  await removeReview((await params).id);
  return NextResponse.json({ ok: true });
}
