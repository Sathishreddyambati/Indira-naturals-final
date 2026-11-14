import type { CouponDoc } from "@/lib/order-types";

export type { CouponDoc };

export function computeDiscount(coupon: CouponDoc | null, subtotal: number): number {
  if (!coupon) return 0;
  if (!coupon.active) return 0;
  if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() < Date.now()) return 0;
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) return 0;
  if (subtotal < coupon.minOrderAmount) return 0;

  if (coupon.type === "percent") {
    return Math.round((subtotal * coupon.value) / 100);
  }
  return Math.min(coupon.value, subtotal);
}

export function computeShipping(subtotal: number, freeThreshold: number, flatRate: number): number {
  if (subtotal <= 0) return 0;
  return subtotal >= freeThreshold ? 0 : flatRate;
}
