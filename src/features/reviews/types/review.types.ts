/** One verified-purchase review. `reviewerDisplayName` is a snapshot taken at
 * submission time, not a live profile join — see `submit_review`'s migration. */
export interface Review {
  id: string;
  orderItemId: string;
  productId: string;
  reviewerDisplayName: string | null;
  rating: number;
  comment: string | null;
  createdAt: string;
}

/** A product's reviews plus a live-computed average — never denormalized. */
export interface ProductReviewSummary {
  reviews: Review[];
  averageRating: number | null;
  reviewCount: number;
}
