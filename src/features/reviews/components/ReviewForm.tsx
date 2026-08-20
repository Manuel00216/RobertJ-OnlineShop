"use client";

import { Star } from "lucide-react";
import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { submitReviewAction } from "@/features/reviews/actions/review.actions";

export interface ReviewFormProps {
  orderId: string;
  orderItemId: string;
  productTitle: string;
}

/**
 * "Write a Review" trigger that expands into a rating + comment form.
 * Verified-purchase gating happens server-side in `submit_review` — this
 * component only renders the entry point for an item the Order Detail page
 * already determined is eligible (delivered, not yet reviewed).
 */
export function ReviewForm({ orderId, orderItemId, productTitle }: ReviewFormProps) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [state, formAction, isPending] = useActionState(submitReviewAction, undefined);

  if (state?.success) {
    return (
      <p className="text-xs font-semibold text-rj-green">
        Thanks — your review was submitted.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-semibold text-rj-red-dark hover:underline"
      >
        Write a Review
      </button>
    );
  }

  const displayRating = hoverRating || rating;

  return (
    <form
      action={formAction}
      className="flex flex-col gap-2 rounded-xl border border-rj-gray-100 bg-rj-gray-50 p-3"
    >
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="orderItemId" value={orderItemId} />
      <input type="hidden" name="rating" value={rating} />

      <p className="text-xs font-semibold text-rj-black">
        Rate {productTitle}
      </p>

      <div
        className="flex items-center gap-1"
        role="radiogroup"
        aria-label="Rating"
        onMouseLeave={() => setHoverRating(0)}
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={rating === star}
            aria-label={`${star} star${star === 1 ? "" : "s"}`}
            onMouseEnter={() => setHoverRating(star)}
            onClick={() => setRating(star)}
          >
            <Star
              className={cn(
                "h-6 w-6 transition-colors",
                star <= displayRating ? "fill-rj-gold text-rj-gold" : "text-rj-gray-300",
              )}
              aria-hidden="true"
            />
          </button>
        ))}
      </div>

      <textarea
        name="comment"
        rows={3}
        maxLength={1000}
        placeholder="Share your experience with this product (optional)"
        className="w-full resize-none rounded-lg border border-rj-gray-200 bg-rj-white px-3 py-2 text-sm outline-none focus:border-rj-black"
      />

      {state && !state.success ? (
        <p className="text-xs font-semibold text-rj-red-dark">{state.error}</p>
      ) : null}

      <div className="flex gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant="rj"
          size="rjSm"
          disabled={rating === 0 || isPending}
          isLoading={isPending}
        >
          Submit review
        </Button>
      </div>
    </form>
  );
}
