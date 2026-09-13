/**
 * Account profile domain model — the editable `profiles` columns. Email lives
 * in `auth.users` and is surfaced alongside via `SessionUser` in the page
 * (there is no direct `auth.users` grant), so it is not part of this model.
 */
export interface Profile {
  id: string;
  fullName: string | null;
  username: string | null;
  /** Set the first time the owner changes their username; once set, further changes are rejected server-side (see `enforce_username_change_once`). */
  usernameChangedAt: string | null;
  avatarUrl: string | null;
  phone: string | null;
  /** Optional; same privacy treatment as `phone` — not readable by direct SELECT for anyone but the owner. */
  gender: "male" | "female" | "other" | null;
  /** Optional, ISO `YYYY-MM-DD`; same privacy treatment as `phone`. */
  dateOfBirth: string | null;
  bio: string | null;
  /** Seller's/admin's receiving QR code image; null for buyers (also DB-enforced). */
  paymentQrUrl: string | null;
  role: string;
}
