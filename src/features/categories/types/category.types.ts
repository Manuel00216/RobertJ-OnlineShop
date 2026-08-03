/** Domain model returned by the category service to the rest of the app. */
export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  /** Cover image from `categories.image_url`; may be null (use a fallback). */
  imageUrl: string | null;
  /** Count of active products in this category, for the "N+ items" label. */
  productCount: number;
}
