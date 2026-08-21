export const ROUTES = {
  home: "/",
  products: "/products",
  productDetail: (slug: string) => `/products/${slug}`,
  categories: "/categories",
  categoryDetail: (slug: string) => `/categories/${slug}`,
  cart: "/cart",
  checkout: "/checkout",
  checkoutConfirmation: "/checkout/confirmation",
  /** Customer account hub (order tracking + overview). See docs/customer-account-architecture-plan.md. */
  account: "/account",
  orders: "/orders",
  orderDetail: (id: string) => `/orders/${id}`,
  profile: "/profile",
  wishlist: "/wishlist",
  dashboard: "/dashboard",
  dashboardProducts: "/dashboard/products",
  dashboardOrders: "/dashboard/orders",
  dashboardOrderDetail: (id: string) => `/dashboard/orders/${id}`,
  inventory: "/dashboard/inventory",
  paymentVerification: "/dashboard/payments",
  reports: "/dashboard/reports",
  /** Admin-only: sellers see their own return requests inline on their own orders, not this queue. */
  dashboardReturns: "/dashboard/returns",
  /** Admin-only dashboard sections — distinct from the (nonexistent) `shops` table. */
  adminUsers: "/dashboard/users",
  adminShops: "/dashboard/shops",
  adminSettings: "/dashboard/settings",
  notifications: "/notifications",
  assistant: "/assistant",
  signIn: "/sign-in",
  signUp: "/sign-up",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  /** OAuth / email-link (PKCE) exchange endpoint. Not a page. */
  authCallback: "/auth/callback",
} as const;

/**
 * Routes that require an authenticated session. `/cart` is intentionally NOT
 * here — it is a public, client-side guest cart (`features/cart` persisted to
 * localStorage); only the routes that commit the cart or expose an account
 * (checkout, orders, notifications, dashboard, profile) are gated.
 */
export const PROTECTED_ROUTE_PREFIXES = [
  "/dashboard",
  "/account",
  "/orders",
  "/checkout",
  "/notifications",
  "/profile",
  "/wishlist",
] as const;

/** Routes an authenticated user should be redirected away from. */
export const AUTH_ROUTES = ["/sign-in", "/sign-up", "/forgot-password"] as const;
