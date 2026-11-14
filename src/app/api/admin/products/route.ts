import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { adminProductSchema } from "@/lib/validation";
import { ConflictError, createProduct, listProducts } from "@/lib/indira-firestore";

export const dynamic = "force-dynamic";

export async function GET() {
  const { session, response } = await requireAdmin();
  if (!session) return response;
  return NextResponse.json(await listProducts());
}

export async function POST(req: Request) {
  const { session, response } = await requireAdmin();
  if (!session) return response;
  const parsed = adminProductSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid product data" }, { status: 400 });
  }
  try {
    return NextResponse.json({ ok: true, id: await createProduct(parsed.data) });
  } catch (err) {
    if (err instanceof ConflictError || err instanceof Error) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
