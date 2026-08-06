/**
 * Account profile domain model — the editable `profiles` columns. Email lives
 * in `auth.users` and is surfaced alongside via `SessionUser` in the page
 * (there is no direct `auth.users` grant), so it is not part of this model.
 */
export interface Profile {
  id: string;
  fullName: string | null;
  username: string | null;
  avatarUrl: string | null;
  phone: string | null;
  bio: string | null;
  /** Seller's/admin's receiving QR code image; null for buyers (also DB-enforced). */
  paymentQrUrl: string | null;
  role: string;
}
