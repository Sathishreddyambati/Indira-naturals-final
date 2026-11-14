import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { seedStarterData } from "@/lib/indira-firestore";

export const dynamic = "force-dynamic";

// Loads the starter products/settings/WELCOME10 coupon. Does nothing if products already exist.
export async function POST() {
  const { session, response } = await requireAdmin();
  if (!session) return response;
  return NextResponse.json({ ok: true, ...(await seedStarterData()) });
}
