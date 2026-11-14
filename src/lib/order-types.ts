// Shared (client + server) order types.

export type OrderStatus = "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled";
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";

export const ORDER_STATUSES: OrderStatus[] = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
];

export type OrderItemDoc = {
  productId: number;
  variantId: number;
  productName: string;
  productSlug: string;
  productImage: string;
  variantLabel: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
};

export type StatusHistoryEntry = {
  status: OrderStatus;
  note: string;
  at: string; // ISO
  by?: string;
};

export type OrderDoc = {
  orderNumber: string;
  customerName: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
  deliveryInstructions: string;
  items: OrderItemDoc[];
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  couponCode: string | null;
  paymentMethod: "cod" | "razorpay";
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  trackingNumber: string | null;
  courierName: string;
  trackingUrl: string; // optional courier tracking link
  adminNote: string;
  statusHistory: StatusHistoryEntry[];
  stockRestored: boolean;
  createdAt: string; // ISO
  updatedAt: string; // ISO
};

/** Order as returned to the admin dashboard (adds the customer-facing tracking link). */
export type AdminOrder = OrderDoc & { trackUrl: string };

export type CouponDoc = {
  code: string;
  type: "percent" | "fixed";
  value: number;
  minOrderAmount: number;
  active: boolean;
  usageLimit: number | null;
  usedCount: number;
  expiresAt: string | null;
  createdAt: string;
};

export type SiteSettings = {
  announcementText: string;
  heroHeadline: string;
  heroSubtext: string;
  heroCtaPrimaryLabel: string;
  heroCtaSecondaryLabel: string;
  freeShippingThreshold: number;
  flatShippingRate: number;
  codEnabled: boolean;
  onlinePaymentEnabled: boolean;
  supportEmail: string;
  supportPhone: string;
  whatsappNumber: string;
  businessAddress: string;
  instagramUrl: string | null;
  facebookUrl: string | null;
  updatedAt: string;
};
