import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { adminSettingsSchema } from "@/lib/validation";
import { getSettings, saveSettings } from "@/lib/indira-firestore";

export const dynamic = "force-dynamic";

export async function GET() {
  const { session, response } = await requireAdmin();
  if (!session) return response;
  return NextResponse.json(await getSettings());
}

export async function PUT(req: Request) {
  const { session, response } = await requireAdmin();
  if (!session) return response;
  const parsed = adminSettingsSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid settings" }, { status: 400 });
  }
  await saveSettings(parsed.data);
  return NextResponse.json({ ok: true });
}
