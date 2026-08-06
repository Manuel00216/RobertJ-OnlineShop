import { publicEnv } from "@/config/env";

/**
 * Resolves a site-relative path to an absolute URL using the validated
 * `NEXT_PUBLIC_SITE_URL`. Shared by anything that needs a real absolute URL
 * (JSON-LD, sitemap) instead of each call site concatenating it ad hoc.
 */
export function absoluteUrl(path: string): string {
  return `${publicEnv.NEXT_PUBLIC_SITE_URL}${path}`;
}
