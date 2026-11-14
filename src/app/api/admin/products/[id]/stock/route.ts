import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { adminStockSchema } from "@/lib/validation";
import { setStock } from "@/lib/indira-firestore";

export const dynamic = "force-dynamic";

// Quick stock control: set one pack size's quantity, or mark the whole product out of stock.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireAdmin();
  if (!session) return response;
  const parsed = adminStockSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid stock update" }, { status: 400 });
  const ok = await setStock(Number((await params).id), parsed.data);
  if (!ok) return NextResponse.json({ error: "Product not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
