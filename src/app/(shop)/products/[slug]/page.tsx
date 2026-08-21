import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { USER_ROLES } from "@/constants/roles";
import { ROUTES } from "@/constants/routes";
import { PRODUCT_CONDITION_LABELS } from "@/constants/status";
import { formatCurrency } from "@/lib/utils/currency";
import { absoluteUrl } from "@/lib/utils/url";
import {
  getProductBySlug,
  getSessionUser,
  getShopNamesBySellerIds,
  isProductWishlisted,
  listProductReviews,
} from "@/lib/supabase/queries";
import { Breadcrumbs } from "@/features/products/components/Breadcrumbs";
import { ProductGallery } from "@/features/products/components/ProductGallery";
import { ProductJsonLd } from "@/features/products/components/ProductJsonLd";
import { ProductQuantityAndAddToCart } from "@/features/products/components/ProductQuantityAndAddToCart";
import { RelatedProducts } from "@/features/products/components/RelatedProducts";
import { ProductReviews } from "@/features/reviews/components/ProductReviews";

interface ProductDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: ProductDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  return {
    title: product?.title ?? "Product not found",
    description: product?.description ?? undefined,
  };
}

export default async function ProductDetailPage({
  params,
}: ProductDetailPageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) notFound();

  const user = await getSessionUser();
  const isWishlisted = user
    ? await isProductWishlisted(user.id, product.id).catch(() => false)
    : false;
  const shopNames = await getShopNamesBySellerIds([product.sellerId]).catch(
    () => new Map<string, string>(),
  );
  // See ProductGrid.tsx's toTileItem for why sellerName is gated on role:
  // only a genuine `seller` account is ever a real shop owner.
  const shopName =
    shopNames.get(product.sellerId) ??
    (product.sellerRole === USER_ROLES.seller ? product.sellerName : null);
  const reviewSummary = await listProductReviews(product.id).catch(() => ({
    reviews: [],
    averageRating: null,
    reviewCount: 0,
  }));

  const breadcrumbItems = [
    { label: "Home", href: ROUTES.home },
    { label: "Products", href: ROUTES.products },
    ...(product.categoryName
      ? [
          {
            label: product.categoryName,
            href: product.categorySlug
              ? ROUTES.categoryDetail(product.categorySlug)
              : undefined,
          },
        ]
      : []),
    { label: product.title },
  ];

  return (
    <article className="flex flex-col gap-10">
      <ProductJsonLd
        product={product}
        url={absoluteUrl(ROUTES.productDetail(product.slug))}
        reviewSummary={reviewSummary}
      />
      <Breadcrumbs items={breadcrumbItems} />

      <div className="grid gap-8 md:grid-cols-2 lg:gap-12">
        <ProductGallery images={product.images} title={product.title} />

        <div className="flex flex-col gap-5">
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.3em] text-rj-red-dark">
              {product.categoryName ?? "New arrival"}
            </p>
            <h1 className="font-serif text-3xl leading-[1.05] text-rj-black md:text-4xl">
              {product.title}
            </h1>
            {shopName ? (
              <p className="mt-2 text-sm text-rj-gray-600">
                Sold by <span className="font-semibold text-rj-black">{shopName}</span>
              </p>
            ) : null}
          </div>

          <p className="text-2xl font-bold text-rj-black">
            {formatCurrency(product.priceCents, product.currency)}
          </p>

          <div className="flex flex-wrap gap-2">
            {product.quantity > 0 ? (
              <span className="rounded-full bg-rj-green/10 px-3 py-1 text-[11px] font-bold text-rj-green">
                {product.quantity} in stock
              </span>
            ) : (
              <span className="rounded-full bg-rj-black px-3 py-1 text-[11px] font-bold text-rj-white">
                Sold out
              </span>
            )}
            <span className="rounded-full border-[1.5px] border-rj-gray-200 px-3 py-1 text-[11px] font-bold text-rj-gray-600">
              {PRODUCT_CONDITION_LABELS[product.condition]}
            </span>
            {product.location ? (
              <span className="rounded-full border-[1.5px] border-rj-gray-200 px-3 py-1 text-[11px] font-bold text-rj-gray-600">
                {product.location}
              </span>
            ) : null}
          </div>

          {product.description ? (
            <p className="text-sm leading-relaxed text-rj-gray-600">
              {product.description}
            </p>
          ) : null}

          <ProductQuantityAndAddToCart
            product={product}
            wishlist={{
              productId: product.id,
              initialSaved: isWishlisted,
              isAuthenticated: user !== null,
            }}
          />
        </div>
      </div>

      <ProductReviews summary={reviewSummary} />

      <Suspense fallback={null}>
        <RelatedProducts product={product} />
      </Suspense>
    </article>
  );
}
