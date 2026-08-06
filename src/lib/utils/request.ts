import { headers } from "next/headers";

/**
 * Best-effort client IP from forwarding headers — used to key rate limiting
 * for the one unauthenticated mutating action (`checkCartAvailabilityAction`),
 * since there's no session to key by instead. Falls back to a shared
 * "unknown" bucket when neither header is present (e.g. local dev).
 */
export async function getClientIp(): Promise<string> {
  const headersList = await headers();
  const forwardedFor = headersList.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }
  return headersList.get("x-real-ip") ?? "unknown";
}
