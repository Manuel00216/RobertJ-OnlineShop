/**
 * Case-insensitive, digit-aware comparator ("natural sort"): embedded number
 * sequences compare by value (e.g. "Shop 2" before "Shop 10") instead of
 * lexicographically (which would put "Shop 10" before "Shop 2").
 */
export function compareNatural(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}
