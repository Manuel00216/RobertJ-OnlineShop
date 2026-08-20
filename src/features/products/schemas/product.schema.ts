import { z } from "zod";

import { PAGINATION } from "@/constants/pagination";
import { PRODUCT_CONDITION, PRODUCT_STATUS } from "@/constants/status";

export const productStatusSchema = z.enum([
  PRODUCT_STATUS.draft,
  PRODUCT_STATUS.active,
  PRODUCT_STATUS.sold,
  PRODUCT_STATUS.archived,
]);

export const productConditionSchema = z.enum([
  PRODUCT_CONDITION.new,
  PRODUCT_CONDITION.likeNew,
  PRODUCT_CONDITION.good,
  PRODUCT_CONDITION.fair,
  PRODUCT_CONDITION.poor,
]);

export const productSortSchema = z.enum([
  "newest",
  "price-asc",
  "price-desc",
  "title-asc",
]);

/** Validates and normalises search params for the product listing. */
export const productListParamsSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(PAGINATION.defaultPage),
    pageSize: z.coerce
      .number()
      .int()
      .min(1)
      .max(PAGINATION.maxPageSize)
      .default(PAGINATION.defaultPageSize),
    search: z.string().trim().max(120).optional(),
    categoryId: z.uuid().optional(),
    shopId: z.uuid().optional(),
    sort: productSortSchema.default("newest"),
    // Deliberately not z.coerce.boolean() — Boolean("false") is true, which
    // would make ?onSale=false behave identically to ?onSale=true.
    onSale: z
      .string()
      .optional()
      .transform((value) => value === "true"),
    // Major-unit pesos from the URL; converted to price_cents in listProducts
    // (queries.ts), matching how createProductSchema's `price` is handled.
    minPrice: z.coerce.number().min(0).optional(),
    maxPrice: z.coerce.number().min(0).optional(),
  })
  .refine(
    (value) =>
      value.minPrice === undefined ||
      value.maxPrice === undefined ||
      value.minPrice <= value.maxPrice,
    {
      message: "Minimum price must be less than maximum price.",
      path: ["minPrice"],
    },
  );

/**
 * Payload for creating a product. `price` arrives in major units from the form
 * and is converted to minor units in the service — the database never sees a
 * fractional amount.
 */
export const createProductSchema = z.object({
  title: z.string().trim().min(2, "Title must be at least 2 characters.").max(160),
  description: z.string().trim().max(5000).optional(),
  price: z.coerce.number().positive("Price must be greater than zero."),
  quantity: z.coerce.number().int().min(0, "Quantity cannot be negative."),
  condition: productConditionSchema.default(PRODUCT_CONDITION.new),
  categoryId: z.uuid("Select a category.").optional(),
  location: z.string().trim().max(160).optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(20).default([]),
  status: productStatusSchema.default(PRODUCT_STATUS.draft),
  /**
   * Admin-only field: which shop this new product belongs to. A seller's
   * submission is always ignored server-side in favor of their own
   * server-resolved shop (`requireOwnShopId()`) — this field exists purely
   * for the admin create-form's shop-picker.
   */
  shopId: z.uuid().optional(),
});

/**
 * `shopId` is deliberately omitted, not just left unset: a product's shop is
 * never reassignable through the general edit form (see `assignProductShopSchema`
 * for the distinct, admin-only reassignment path).
 */
export const updateProductSchema = createProductSchema
  .omit({ shopId: true })
  .partial()
  .extend({
    id: z.uuid(),
  });

/** Admin-only: assign a shop to a legacy/unassigned product. */
export const assignProductShopSchema = z.object({
  productId: z.uuid(),
  shopId: z.uuid(),
});

export type ProductListParamsInput = z.input<typeof productListParamsSchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type AssignProductShopInput = z.infer<typeof assignProductShopSchema>;
