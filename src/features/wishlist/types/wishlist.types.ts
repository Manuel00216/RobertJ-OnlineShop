/** Wishlist payload threaded into `ProductTileItem`/PDP so the heart button
 * knows what to toggle, its initial state, and whether to prompt sign-in,
 * all without an extra client-side fetch. */
export interface WishlistState {
  productId: string;
  initialSaved: boolean;
  isAuthenticated: boolean;
}
