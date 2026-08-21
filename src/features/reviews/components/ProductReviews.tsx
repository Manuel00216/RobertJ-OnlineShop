import { EmptyState } from "@/components/feedback/EmptyState";
import { StarRating } from "@/features/reviews/components/StarRating";
import type { ProductReviewSummary } from "@/features/reviews/types/review.types";

export interface ProductReviewsProps {
  summary: ProductReviewSummary;
}

/** Reviews section for the PDP: live average + count, then the review list. */
export function ProductReviews({ summary }: ProductReviewsProps) {
  const { reviews, averageRating, reviewCount } = summary;

  return (
    <section aria-label="Reviews" className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <h2 className="font-serif text-2xl text-rj-black">Reviews</h2>
        {reviewCount > 0 && averageRating !== null ? (
          <div className="flex items-center gap-2">
            <StarRating rating={averageRating} size="md" />
            <span className="text-sm font-semibold text-rj-black">
              {averageRating.toFixed(1)}
            </span>
            <span className="text-sm text-rj-gray-400">
              ({reviewCount} review{reviewCount === 1 ? "" : "s"})
            </span>
          </div>
        ) : null}
      </div>

      {reviewCount === 0 ? (
        <EmptyState
          title="No reviews yet"
          description="Be the first to review this product after your order is delivered."
        />
      ) : (
        <ul className="flex flex-col gap-4">
          {reviews.map((review) => (
            <li
              key={review.id}
              className="rounded-2xl border border-rj-gray-100 bg-rj-white p-4"
            >
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-rj-black">
                  {review.reviewerDisplayName ?? "RobertJ Customer"}
                </span>
                <StarRating rating={review.rating} />
              </div>
              {review.comment ? (
                <p className="text-sm leading-relaxed text-rj-gray-600">
                  {review.comment}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
