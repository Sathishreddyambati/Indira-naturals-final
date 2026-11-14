import "server-only";
import crypto from "crypto";

function secret() {
  const s =
    process.env.ORDER_LINK_SECRET ||
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
    process.env.FIREBASE_PRIVATE_KEY;
  if (!s) throw new Error("Set ORDER_LINK_SECRET (or FIREBASE_SERVICE_ACCOUNT_JSON)");
  return crypto.createHash("sha256").update(`indira-order-link:${s}`).digest();
}

export function signOrder(orderNumber: string): string {
  return crypto.createHmac("sha256", secret()).update(orderNumber).digest("hex").slice(0, 16);
}

export function verifyOrderKey(orderNumber: string, key: string | undefined): boolean {
  if (!key) return false;
  const a = Buffer.from(signOrder(orderNumber));
  const b = Buffer.from(key);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function getSiteUrl(req?: Request): string {
  // Always use the address the customer is really on, so links can never point to a wrong domain.
  if (req) {
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
    const proto = req.headers.get("x-forwarded-proto") || "https";
    if (host && !/localhost|127\.0\.0\.1/.test(host)) return `${proto}://${host}`;
  }
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env && !/localhost/.test(env)) return env.replace(/\/$/, "");
  if (req) return new URL(req.url).origin;
  const v = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (v) return `https://${v}`;
  return (env || "http://localhost:3000").replace(/\/$/, "");
}

/** Secret customer tracking link: no email needed, works only with the signed key. */
export function buildTrackUrl(base: string, orderNumber: string): string {
  return `${base}/track/${encodeURIComponent(orderNumber)}?k=${signOrder(orderNumber)}`;
}
