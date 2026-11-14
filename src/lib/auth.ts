import "server-only";
import { cookies } from "next/headers";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { COLLECTIONS } from "@/lib/indira-firestore";

export const SESSION_COOKIE = "indira_admin_session";
export const SESSION_DURATION_MS = 1000 * 60 * 60 * 8; // 8 hours

export type AdminSession = { uid: string; email: string; name: string };

/** Who may enter the dashboard: ADMIN_EMAILS env var, or a doc in the `indira_admins` collection. */
export async function isAdminEmail(email: string | undefined | null): Promise<boolean> {
  if (!email) return false;
  const e = email.trim().toLowerCase();
  const allowed = (process.env.ADMIN_EMAILS || "bonthadileep1234@gmail.com")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.includes(e)) return true;
  try {
    const snap = await getAdminDb().collection(COLLECTIONS.admins).doc(e).get();
    return snap.exists && snap.data()?.active !== false;
  } catch {
    return false;
  }
}

/** Verifies a Firebase ID token from the login screen and starts a secure session cookie. */
export async function createAdminSession(idToken: string): Promise<AdminSession | null> {
  const auth = getAdminAuth();
  const decoded = await auth.verifyIdToken(idToken);
  if (!(await isAdminEmail(decoded.email))) return null;
  const cookie = await auth.createSessionCookie(idToken, { expiresIn: SESSION_DURATION_MS });
  (await cookies()).set(SESSION_COOKIE, cookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_MS / 1000,
  });
  return { uid: decoded.uid, email: decoded.email!, name: decoded.name || decoded.email! };
}

export async function destroyAdminSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const decoded = await getAdminAuth().verifySessionCookie(token, true);
    if (!(await isAdminEmail(decoded.email))) return null;
    return { uid: decoded.uid, email: decoded.email!, name: decoded.name || decoded.email! };
  } catch {
    return null;
  }
}
