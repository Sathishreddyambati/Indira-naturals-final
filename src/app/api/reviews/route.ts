import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { addReview } from "@/lib/indira-firestore";

export const dynamic = "force-dynamic";

const schema = z.object({
  productId: z.number().int().positive(),
  rating: z.number().int().min(1).max(5),
  customerName: z.string().trim().min(2).max(120),
  title: z.string().trim().max(160).optional().or(z.literal("")),
  body: z.string().trim().min(5).max(2000),
});

export async function POST(req: Request) {
  const ip = getClientIp(req);
  if (!rateLimit(`review:${ip}`, 5, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many submissions. Please try again later." }, { status: 429 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid input" }, { status: 400 });
  }
  const ok = await addReview(parsed.data);
  if (!ok) return NextResponse.json({ error: "Product not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
