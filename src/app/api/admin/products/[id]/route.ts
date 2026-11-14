import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { adminProductSchema } from "@/lib/validation";
import { deleteProduct, getProductById, updateProduct } from "@/lib/indira-firestore";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { session, response } = await requireAdmin();
  if (!session) return response;
  const product = await getProductById(Number((await params).id));
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });
  return NextResponse.json(product);
}

export async function PUT(req: Request, { params }: Ctx) {
  const { session, response } = await requireAdmin();
  if (!session) return response;
  const parsed = adminProductSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid product data" }, { status: 400 });
  }
  try {
    const ok = await updateProduct(Number((await params).id), parsed.data);
    if (!ok) return NextResponse.json({ error: "Product not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not save" }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { session, response } = await requireAdmin();
  if (!session) return response;
  await deleteProduct(Number((await params).id));
  return NextResponse.json({ ok: true });
}
