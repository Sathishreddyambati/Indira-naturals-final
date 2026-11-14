import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { getDashboardStats } from "@/lib/orders";

export const dynamic = "force-dynamic";

export async function GET() {
  const { session, response } = await requireAdmin();
  if (!session) return response;
  return NextResponse.json(await getDashboardStats());
}
