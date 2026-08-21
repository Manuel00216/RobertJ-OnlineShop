/** Lifecycle of any async view: drives loading / error / empty / success UI. */
export type AsyncState = "idle" | "loading" | "error" | "empty" | "success";

/** Minimal user shape shared across features. */
export interface SessionUser {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  role: string;
  /** Admin-controlled account state — see `requireSessionUser()`, the enforcement point. */
  isActive: boolean;
}

export type Nullable<T> = T | null;
