import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { adminMessageUpdateSchema } from "@/lib/validation";
import { setMessageStatus } from "@/lib/indira-firestore";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, response } = await requireAdmin();
  if (!session) return response;
  const parsed = adminMessageUpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  await setMessageStatus((await params).id, parsed.data.status);
  return NextResponse.json({ ok: true });
}
