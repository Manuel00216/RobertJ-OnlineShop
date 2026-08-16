import { publicEnv } from "@/config/env";

/**
 * Resolves a site-relative path to an absolute URL using the validated
 * `NEXT_PUBLIC_SITE_URL`. Shared by anything that needs a real absolute URL
 * (JSON-LD, sitemap) instead of each call site concatenating it ad hoc.
 */
export function absoluteUrl(path: string): string {
  return `${publicEnv.NEXT_PUBLIC_SITE_URL}${path}`;
}

/**
 * True only for same-origin, absolute-path redirect targets. Rejects
 * protocol-relative paths like `//evil.com` — browsers treat a leading `//`
 * as an absolute off-site URL, so `startsWith("/")` alone is not enough to
 * guard a redirect against being hijacked off-site.
 */
export function isInternalPath(path: string | null | undefined): path is string {
  return !!path && path.startsWith("/") && !path.startsWith("//");
}
