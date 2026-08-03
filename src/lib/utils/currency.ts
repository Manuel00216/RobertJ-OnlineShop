import { siteConfig } from "@/config/site";

/** Formats a minor-unit amount (centavos) as a localised currency string. */
export function formatCurrency(
  amountInCents: number,
  currency: string = siteConfig.currency,
  locale: string = siteConfig.locale,
) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(amountInCents / 100);
}

/** Converts a major-unit input (e.g. "199.50") to minor units. */
export function toCents(amount: number) {
  return Math.round(amount * 100);
}

/** Converts minor units back to a major-unit number. */
export function fromCents(amountInCents: number) {
  return amountInCents / 100;
}
