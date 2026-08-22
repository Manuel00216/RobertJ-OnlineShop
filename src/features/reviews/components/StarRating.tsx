import { Star } from "lucide-react";

import { cn } from "@/lib/utils/cn";

export interface StarRatingProps {
  /** 0-5, fractional allowed for an average (rendered as whole-star fill). */
  rating: number;
  size?: "sm" | "md";
  className?: string;
}

/** Read-only 5-star display. For the interactive picker, see `RatingPicker`. */
export function StarRating({ rating, size = "sm", className }: StarRatingProps) {
  const dimension = size === "sm" ? "h-3.5 w-3.5" : "h-5 w-5";
  return (
    <div className={cn("flex items-center gap-0.5", className)} role="img" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            dimension,
            star <= Math.round(rating) ? "fill-rj-gold text-rj-gold" : "text-rj-gray-200",
          )}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}
