import type { MetadataRoute } from "next";

import { PROTECTED_ROUTE_PREFIXES, ROUTES } from "@/constants/routes";
import { absoluteUrl } from "@/lib/utils/url";

/** Pairs with sitemap.ts — disallows the same protected/auth-flow-only routes. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        ...PROTECTED_ROUTE_PREFIXES,
        ROUTES.resetPassword,
        ROUTES.authCallback,
      ],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
