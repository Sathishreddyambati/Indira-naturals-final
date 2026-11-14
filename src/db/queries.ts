// Public (storefront) read queries, backed by Firestore.
// Same function names / return shapes the pages already use.
import {
  getSettingsCached,
  listApprovedReviewsForProduct,
  listProductsCached,
  listReviews,
  type ProductDoc,
} from "@/lib/indira-firestore";
import type { ProductDTO } from "@/lib/types";
import type { SiteSettings } from "@/lib/order-types";

function toDTO(p: ProductDoc): ProductDTO {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    shortDescription: p.shortDescription,
    description: p.description,
    category: p.category,
    image: p.image,
    galleryImages: p.galleryImages,
    ingredients: p.ingredients,
    netWeightLabel: p.netWeightLabel,
    usageInstructions: p.usageInstructions,
    storageInstructions: p.storageInstructions,
    allergenInfo: p.allergenInfo,
    skuPrefix: p.skuPrefix,
    status: p.status,
    featured: p.featured,
    bestseller: p.bestseller,
    seoTitle: p.seoTitle,
    seoDescription: p.seoDescription,
    avgRating: p.avgRating,
    reviewCount: p.reviewCount,
    variants: p.variants.map((v) => ({
      id: v.id,
      label: v.label,
      weightGrams: v.weightGrams,
      sku: v.sku,
      price: v.price,
      comparePrice: v.comparePrice,
      stock: v.stock,
      isDefault: v.isDefault,
    })),
  };
}

export async function getAllPublishedProducts(): Promise<ProductDTO[]> {
  const all = await listProductsCached();
  return all.filter((p) => p.status === "published").map(toDTO);
}

export async function getProductBySlug(slug: string): Promise<ProductDTO | null> {
  const all = await listProductsCached();
  const p = all.find((x) => x.slug === slug && x.status === "published");
  return p ? toDTO(p) : null;
}

export async function getProductsByIds(ids: number[]): Promise<ProductDTO[]> {
  const all = await listProductsCached();
  return all.filter((p) => ids.includes(p.id)).map(toDTO);
}

export async function getApprovedReviewsForProduct(productId: number) {
  return listApprovedReviewsForProduct(productId);
}

export async function getFeaturedReviews(limit = 6) {
  const [approved, products] = await Promise.all([listReviews("approved"), listProductsCached()]);
  const bySlug = new Map(products.map((p) => [p.id, p]));
  return approved
    .filter((r) => bySlug.has(r.productId))
    .slice(0, limit)
    .map((r) => ({
      id: r.id,
      customerName: r.customerName,
      rating: r.rating,
      title: r.title,
      body: r.body,
      verifiedPurchase: r.verifiedPurchase,
      createdAt: r.createdAt,
      productId: r.productId,
      productName: bySlug.get(r.productId)!.name,
      productSlug: bySlug.get(r.productId)!.slug,
    }));
}

export type SiteSettingsDTO = SiteSettings;

export async function getSiteSettings(): Promise<SiteSettingsDTO> {
  return getSettingsCached();
}
