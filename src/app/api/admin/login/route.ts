import { NextResponse } from "next/server";
import { adminSessionSchema } from "@/lib/validation";
import { createAdminSession } from "@/lib/auth";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// The browser signs in with Firebase Authentication (email + password), then sends the
// resulting ID token here. We verify it on the server and start an 8-hour session cookie.
export async function POST(req: Request) {
  const ip = getClientIp(req);
  if (!rateLimit(`admin-login:${ip}`, 10, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many login attempts. Please try again later." }, { status: 429 });
  }
  const parsed = adminSessionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid login" }, { status: 400 });

  try {
    const session = await createAdminSession(parsed.data.idToken);
    if (!session) {
      return NextResponse.json({ error: "This account is not allowed to open the admin dashboard." }, { status: 403 });
    }
    return NextResponse.json({ ok: true, email: session.email });
  } catch (err) {
    console.error("admin login failed", err);
    return NextResponse.json({ error: "Login failed. Please sign in again." }, { status: 401 });
  }
}
