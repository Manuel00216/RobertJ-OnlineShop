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
export const productListParamsSchema = z.object({
  page: z.coerce.number().int().min(1).default(PAGINATION.defaultPage),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(PAGINATION.maxPageSize)
    .default(PAGINATION.defaultPageSize),
  search: z.string().trim().min(1).max(120).optional(),
  categoryId: z.uuid().optional(),
  status: productStatusSchema.optional(),
  sellerId: z.uuid().optional(),
  sort: productSortSchema.default("newest"),
});

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
});

export const updateProductSchema = createProductSchema.partial().extend({
  id: z.uuid(),
});

export type ProductListParamsInput = z.input<typeof productListParamsSchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
