"use client";

import { useState, useTransition } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/feedback/ErrorState";
import { FormField } from "@/components/forms/FormField";
import { createProductVariantAction } from "@/features/products/actions/product-variant.actions";
import { ProductVariantRow } from "@/features/products/components/ProductVariantRow";
import {
  productVariantSchema,
  type ProductVariantFormInput,
} from "@/features/products/schemas/product-variant.schema";
import type { Product, ProductVariant } from "@/features/products/types/product.types";
import { formatCurrency } from "@/lib/utils/currency";

type FieldErrors = Record<string, string[] | undefined>;

function emptyInput(productId: string): ProductVariantFormInput {
  return { productId, sku: "", color: "", size: "", price: undefined };
}

export interface ProductVariantManagerProps {
  product: Product;
  variants: ProductVariant[];
}

/**
 * Optional color/size variant management for one product — edit-mode only
 * (a variant needs a real product id, so this never appears in create mode).
 * Mirrors the Addresses feature's list/add/edit/delete shape. `ProductForm`
 * itself is untouched; this is a sibling block, not a change to it.
 */
export function ProductVariantManager({ product, variants: initialVariants }: ProductVariantManagerProps) {
  const [variants, setVariants] = useState<ProductVariant[]>(initialVariants);
  const [isAdding, setIsAdding] = useState(false);
  const [values, setValues] = useState<ProductVariantFormInput>(() => emptyInput(product.id));
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleChange(field: "sku" | "color" | "size", value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  }

  function handleAdd() {
    setFormError(null);
    const parsed = productVariantSchema.safeParse({
      ...values,
      price: values.price === undefined || Number.isNaN(values.price) ? undefined : values.price,
    });
    if (!parsed.success) {
      setFieldErrors(z.flattenError(parsed.error).fieldErrors as FieldErrors);
      return;
    }
    startTransition(async () => {
      const result = await createProductVariantAction(parsed.data);
      if (!result.success) {
        setFormError(result.error);
        return;
      }
      setVariants((prev) => [...prev, result.data]);
      setValues(emptyInput(product.id));
      setFieldErrors({});
      setIsAdding(false);
    });
  }

  function handleCancelAdd() {
    setValues(emptyInput(product.id));
    setFieldErrors({});
    setFormError(null);
    setIsAdding(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-sm font-semibold text-foreground">Variants (optional)</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Add color/size options, each with their own stock (managed from Inventory). Leave price
          blank to use this product&apos;s price ({formatCurrency(product.priceCents, product.currency)}).
        </p>
      </div>

      {variants.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No variants yet — this product sells as a single item.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {variants.map((variant) => (
            <ProductVariantRow
              key={variant.id}
              variant={variant}
              product={product}
              onChange={(updated) =>
                setVariants((prev) => prev.map((v) => (v.id === updated.id ? updated : v)))
              }
              onDelete={(id) => setVariants((prev) => prev.filter((v) => v.id !== id))}
            />
          ))}
        </ul>
      )}

      {isAdding ? (
        <div className="rounded-xl border border-border p-4">
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <FormField
                label="Color"
                value={values.color ?? ""}
                onChange={(event) => handleChange("color", event.target.value)}
                placeholder="e.g. Blue"
                errors={fieldErrors.color}
              />
              <FormField
                label="Size"
                value={values.size ?? ""}
                onChange={(event) => handleChange("size", event.target.value)}
                placeholder="e.g. Medium"
                errors={fieldErrors.size}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField
                label="SKU (optional)"
                value={values.sku ?? ""}
                onChange={(event) => handleChange("sku", event.target.value)}
                errors={fieldErrors.sku}
              />
              <FormField
                label="Price override (optional)"
                type="number"
                step="0.01"
                min="0.01"
                placeholder={`Inherits ${formatCurrency(product.priceCents, product.currency)}`}
                value={values.price ?? ""}
                onChange={(event) =>
                  setValues((prev) => ({
                    ...prev,
                    price: event.target.value === "" ? undefined : Number(event.target.value),
                  }))
                }
                errors={fieldErrors.price}
              />
            </div>
            {formError ? <ErrorState title="Couldn't add variant" message={formError} /> : null}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="rj" size="rjSm" isLoading={isPending} onClick={handleAdd}>
                Add variant
              </Button>
              <Button
                type="button"
                variant="outline"
                size="rjSm"
                disabled={isPending}
                onClick={handleCancelAdd}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="rjSm"
          className="self-start"
          onClick={() => setIsAdding(true)}
        >
          + Add variant
        </Button>
      )}
    </div>
  );
}
