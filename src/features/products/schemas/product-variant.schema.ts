import { z } from "zod";

import { productStatusSchema } from "@/features/products/schemas/product.schema";

/**
 * A variant's editable catalog attributes. Stock is never here — see
 * `adjustStockSchema` (variants are adjusted through the same `adjust_stock`
 * RPC path as a plain product, just with `variantId` set).
 */
export const productVariantSchema = z
  .object({
    productId: z.uuid(),
    sku: z.string().trim().max(60).optional(),
    color: z.string().trim().max(60).optional(),
    size: z.string().trim().max(60).optional(),
    /** Major-unit pesos; leave blank to inherit the parent product's price. */
    price: z.coerce.number().positive("Price must be greater than zero.").optional(),
  })
  .refine((value) => Boolean(value.color) || Boolean(value.size), {
    message: "Enter a color or size.",
    path: ["color"],
  });

export const updateProductVariantSchema = z
  .object({
    id: z.uuid(),
    sku: z.string().trim().max(60).optional(),
    color: z.string().trim().max(60).optional(),
    size: z.string().trim().max(60).optional(),
    price: z.coerce.number().positive("Price must be greater than zero.").optional(),
    status: productStatusSchema.optional(),
  })
  .refine((value) => Boolean(value.color) || Boolean(value.size), {
    message: "Enter a color or size.",
    path: ["color"],
  });

export const deleteProductVariantSchema = z.object({
  id: z.uuid(),
});

export type ProductVariantFormInput = z.infer<typeof productVariantSchema>;
export type UpdateProductVariantInput = z.infer<typeof updateProductVariantSchema>;
export type DeleteProductVariantInput = z.infer<typeof deleteProductVariantSchema>;
