"use client";

import Image from "next/image";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/feedback/ErrorState";
import { FormField } from "@/components/forms/FormField";
import { PRODUCT_CONDITION_LABELS, PRODUCT_STATUS_LABELS } from "@/constants/status";
import {
  createProductAction,
  deleteProductImageAction,
  updateProductAction,
  uploadProductImageAction,
} from "@/features/products/actions/product.actions";
import type { Category } from "@/features/categories/types/category.types";
import type { Product, ProductImage } from "@/features/products/types/product.types";
import type { Shop } from "@/features/shops/types/shop.types";
import { fromCents } from "@/lib/utils/currency";
import type { ActionResult } from "@/types/action.types";

const IMAGE_INPUT_ACCEPT = "image/jpeg,image/png,image/webp";

/** A file picked in create mode, held client-side until the product exists. */
interface PendingImage {
  file: File;
  previewUrl: string;
}

const selectClasses =
  "h-10 rounded-md border border-border bg-background px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring";
const textareaClasses =
  "min-h-24 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring";

export interface ProductFormProps {
  categories: Category[];
  /**
   * Shops the caller may create/reassign into — only ever populated for an
   * admin (from `listShops()`). A seller never sees this field; their shop
   * is always resolved server-side (`requireOwnShopId()`), never taken from
   * this form even if a value were somehow present in the submission.
   */
  shops?: Shop[];
  /** Omit for create mode; pass the product being edited for edit mode. */
  product?: Product;
  onDone?: () => void;
}

/**
 * Shared create/edit form — one component for both roles and both modes.
 * The only role-conditional rendering is the admin-only shop picker; every
 * other field and the submit action are identical regardless of who's using it.
 */
export function ProductForm({ categories, shops, product, onDone }: ProductFormProps) {
  const isEdit = Boolean(product);
  const [state, formAction, isPending] = useActionState<
    ActionResult<Product> | null,
    FormData
  >(isEdit ? updateProductAction : createProductAction, null);

  const fieldErrors = state && !state.success ? state.fieldErrors : undefined;
  const formError = state && !state.success && !state.fieldErrors ? state.error : undefined;

  // Edit mode: images already exist server-side, managed against the live list.
  const [images, setImages] = useState<ProductImage[]>(product?.images ?? []);
  // Create mode: the product doesn't exist yet, so files are held client-side
  // and uploaded once `createProductAction` returns an id (see the effect below).
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);
  const [isImagePending, startImageTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!state?.success) return;

    if (!isEdit && pendingImages.length > 0) {
      const newProductId = state.data.id;
      startImageTransition(async () => {
        for (const pending of pendingImages) {
          const formData = new FormData();
          formData.append("image", pending.file);
          const result = await uploadProductImageAction(newProductId, formData);
          if (!result.success) setImageError(result.error);
          URL.revokeObjectURL(pending.previewUrl);
        }
        setPendingImages([]);
        onDone?.();
      });
      return;
    }

    onDone?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function handleFilesSelected(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    setImageError(null);

    if (isEdit && product) {
      startImageTransition(async () => {
        for (const file of files) {
          const formData = new FormData();
          formData.append("image", file);
          const result = await uploadProductImageAction(product.id, formData);
          if (result.success) {
            setImages((current) => [...current, result.data]);
          } else {
            setImageError(result.error);
          }
        }
      });
    } else {
      setPendingImages((current) => [
        ...current,
        ...files.map((file) => ({ file, previewUrl: URL.createObjectURL(file) })),
      ]);
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleRemovePendingImage(previewUrl: string) {
    setPendingImages((current) => current.filter((image) => image.previewUrl !== previewUrl));
    URL.revokeObjectURL(previewUrl);
  }

  function handleDeleteImage(imageId: string) {
    if (!product) return;
    setImageError(null);
    startImageTransition(async () => {
      const result = await deleteProductImageAction(imageId, product.id);
      if (result.success) {
        setImages((current) => current.filter((image) => image.id !== imageId));
      } else {
        setImageError(result.error);
      }
    });
  }

  return (
    <form action={formAction} noValidate aria-busy={isPending} className="flex flex-col gap-4">
      {formError ? <ErrorState title="Couldn't save the product" message={formError} /> : null}

      {product ? <input type="hidden" name="id" value={product.id} /> : null}

      <FormField
        name="title"
        label="Title"
        defaultValue={product?.title ?? ""}
        placeholder="e.g. Vintage Denim Jacket"
        errors={fieldErrors?.title}
        required
      />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="product-description" className="text-sm font-medium">
          Description
        </label>
        <textarea
          id="product-description"
          name="description"
          defaultValue={product?.description ?? ""}
          placeholder="Describe the item…"
          className={textareaClasses}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Photos</span>

        {images.length > 0 || pendingImages.length > 0 ? (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {images.map((image) => (
              <div key={image.id} className="group relative aspect-square overflow-hidden rounded-md border border-border">
                <Image
                  src={image.url}
                  alt={image.altText ?? ""}
                  fill
                  className="object-cover"
                  sizes="120px"
                />
                <button
                  type="button"
                  onClick={() => handleDeleteImage(image.id)}
                  disabled={isImagePending}
                  aria-label="Remove image"
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white transition-opacity hover:bg-black/80 disabled:opacity-50"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            ))}
            {pendingImages.map((pending) => (
              <div
                key={pending.previewUrl}
                className="group relative aspect-square overflow-hidden rounded-md border border-border"
              >
                <Image
                  src={pending.previewUrl}
                  alt=""
                  fill
                  unoptimized
                  className="object-cover"
                  sizes="120px"
                />
                <button
                  type="button"
                  onClick={() => handleRemovePendingImage(pending.previewUrl)}
                  aria-label="Remove image"
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white transition-opacity hover:bg-black/80"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <input
          ref={fileInputRef}
          type="file"
          accept={IMAGE_INPUT_ACCEPT}
          multiple
          onChange={(event) => handleFilesSelected(event.target.files)}
          disabled={isImagePending}
          className="text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-rj-black file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-rj-white"
        />
        {imageError ? (
          <p role="alert" className="text-xs text-rj-red-dark">
            {imageError}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField
          name="price"
          label="Price (PHP)"
          type="number"
          step="0.01"
          min="0.01"
          defaultValue={product ? fromCents(product.priceCents) : undefined}
          errors={fieldErrors?.price}
          required
        />
        <FormField
          name="quantity"
          label="Quantity"
          type="number"
          min="0"
          step="1"
          defaultValue={product?.quantity ?? 0}
          errors={fieldErrors?.quantity}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="product-condition" className="text-sm font-medium">
            Condition
          </label>
          <select
            id="product-condition"
            name="condition"
            defaultValue={product?.condition ?? "new"}
            className={selectClasses}
          >
            {Object.entries(PRODUCT_CONDITION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="product-status" className="text-sm font-medium">
            Status
          </label>
          <select
            id="product-status"
            name="status"
            defaultValue={product?.status ?? "draft"}
            className={selectClasses}
          >
            {Object.entries(PRODUCT_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="product-category" className="text-sm font-medium">
          Category
        </label>
        <select
          id="product-category"
          name="categoryId"
          defaultValue={product?.categoryId ?? ""}
          className={selectClasses}
        >
          <option value="">No category</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      <FormField
        name="location"
        label="Location"
        defaultValue={product?.location ?? ""}
        placeholder="e.g. Quezon City"
        errors={fieldErrors?.location}
      />

      {!isEdit && shops && shops.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="product-shop" className="text-sm font-medium">
            Shop
          </label>
          <select id="product-shop" name="shopId" className={selectClasses} required>
            <option value="">Select a shop…</option>
            {shops.map((shop) => (
              <option key={shop.id} value={shop.id}>
                {shop.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <Button type="submit" variant="rj" size="rj" isLoading={isPending} className="w-full sm:w-auto">
        {isPending ? "Saving…" : isEdit ? "Save changes" : "Create product"}
      </Button>
    </form>
  );
}
