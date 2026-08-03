import { siteConfig } from "@/config/site";

/** Formats an ISO timestamp as a readable date. */
export function formatDate(
  isoDate: string,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium" },
) {
  return new Intl.DateTimeFormat(siteConfig.locale, options).format(
    new Date(isoDate),
  );
}

/** Formats an ISO timestamp as a date and time. */
export function formatDateTime(isoDate: string) {
  return formatDate(isoDate, { dateStyle: "medium", timeStyle: "short" });
}
