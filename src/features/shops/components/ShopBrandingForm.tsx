"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/feedback/ErrorState";
import { updateOwnShopDescriptionAction } from "@/features/shops/actions/shop.actions";
import type { Shop } from "@/features/shops/types/shop.types";
import type { ActionResult } from "@/types/action.types";

const textareaClasses =
  "min-h-28 rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

/** Matches the `shops_description_length` CHECK constraint. */
const MAX_DESCRIPTION_LENGTH = 500;

export interface ShopBrandingFormProps {
  shop: Shop;
}

/** Description-only — name/active/slug/image columns are never part of this
 * form's payload (see `updateOwnShopDescriptionAction`). */
export function ShopBrandingForm({ shop }: ShopBrandingFormProps) {
  const [state, formAction, isPending] = useActionState<ActionResult<Shop> | null, FormData>(
    updateOwnShopDescriptionAction,
    null,
  );
  const [description, setDescription] = useState(shop.description ?? "");
  const [justSaved, setJustSaved] = useState(false);
  // Tracks the last `state` this component has reacted to, so a successful
  // save can adjust `description`/`justSaved` during render (React's
  // recommended alternative to a `useEffect` here — see "You Might Not Need
  // an Effect") instead of calling setState inside an effect body.
  const [handledState, setHandledState] = useState(state);

  const fieldErrors = state && !state.success ? state.fieldErrors : undefined;
  const formError = state && !state.success && !state.fieldErrors ? state.error : undefined;

  if (state !== handledState) {
    setHandledState(state);
    if (state?.success) {
      setDescription(state.data.description ?? "");
      setJustSaved(true);
    }
  }

  return (
    <form action={formAction} noValidate aria-busy={isPending} className="flex flex-col gap-2">
      {formError ? <ErrorState title="Couldn't save your shop" message={formError} /> : null}

      <label htmlFor="shop-description" className="text-sm font-medium">
        Description
      </label>
      <textarea
        id="shop-description"
        name="description"
        value={description}
        onChange={(event) => {
          setDescription(event.target.value);
          setJustSaved(false);
        }}
        maxLength={MAX_DESCRIPTION_LENGTH}
        placeholder="Tell buyers what your shop is about…"
        className={textareaClasses}
      />
      <div className="flex items-center justify-between">
        {fieldErrors?.description ? (
          <p className="text-xs text-danger" role="alert">
            {fieldErrors.description[0]}
          </p>
        ) : (
          <span />
        )}
        <span className="text-xs text-muted-foreground">
          {description.length}/{MAX_DESCRIPTION_LENGTH}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" variant="rj" size="rj" isLoading={isPending} className="w-full sm:w-auto">
          {isPending ? "Saving…" : "Save description"}
        </Button>
        {justSaved && !isPending ? (
          <span className="text-xs font-medium text-success" role="status">
            Saved
          </span>
        ) : null}
      </div>
    </form>
  );
}
