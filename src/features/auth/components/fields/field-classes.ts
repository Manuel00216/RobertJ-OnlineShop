/**
 * Shared input shape for auth fields (frozen UI/UX spec §1): the landing's
 * `rounded-xl` tile radius extended to a full-width field, resting border
 * `border-rj-gray-600` (≈5.0:1, meets WCAG 1.4.11), red focus ring.
 * `cn()`/twMerge resolves the overlap with `FormField`'s base input classes.
 */
export const AUTH_INPUT_CLASS =
  "h-auto w-full rounded-xl border border-rj-gray-600 bg-rj-white px-4 py-3 text-sm text-rj-black shadow-sm outline-none transition-colors placeholder:text-rj-gray-400 focus-visible:border-rj-red focus-visible:ring-2 focus-visible:ring-rj-red/30";
