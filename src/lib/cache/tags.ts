/** Cache tags used with revalidateTag so invalidation stays consistent. */
export const CACHE_TAGS = {
  products: "products",
  product: (slug: string) => `product:${slug}`,
  categories: "categories",
  orders: (userId: string) => `orders:${userId}`,
} as const;
