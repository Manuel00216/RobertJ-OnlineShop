/** English number words this module understands, generically — not any
 * specific shop name. Covers ones/teens, tens, and the "hundred"/"thousand"
 * scale words needed to parse compound numbers like "Twenty One". */
const NUMBER_WORDS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  hundred: 100,
  thousand: 1000,
};

/** Converts a run of number-word tokens (already lowercased) into a value,
 * e.g. ["twenty", "one"] -> 21, ["one", "hundred"] -> 100. Returns null if
 * any token isn't a recognized number word. */
function wordsToNumber(words: string[]): number | null {
  let total = 0;
  let current = 0;
  let matched = false;

  for (const word of words) {
    if (word === "and") continue;
    const value = NUMBER_WORDS[word];
    if (value === undefined) return null;
    matched = true;

    if (value === 100) {
      current = (current || 1) * value;
    } else if (value === 1000) {
      total += (current || 1) * value;
      current = 0;
    } else {
      current += value;
    }
  }

  return matched ? total + current : null;
}

/**
 * Rewrites a trailing spelled-out number ("Shop Twelve") into digits
 * ("Shop 12") so a numeric-aware compare orders it by value instead of
 * alphabetically. Names with no trailing number word (or already using
 * digits) are returned unchanged. Generic — derived from the name itself,
 * never a hardcoded name/ID lookup.
 */
function normalizeTrailingNumberWords(value: string): string {
  const tokens = value.trim().split(/\s+/);
  let splitIndex = tokens.length;

  for (let i = tokens.length - 1; i >= 0; i--) {
    const word = tokens[i].toLowerCase();
    if (word === "and" || word in NUMBER_WORDS) {
      splitIndex = i;
    } else {
      break;
    }
  }

  if (splitIndex === tokens.length) return value;

  const amount = wordsToNumber(tokens.slice(splitIndex).map((word) => word.toLowerCase()));
  if (amount === null) return value;

  const prefix = tokens.slice(0, splitIndex).join(" ");
  return prefix ? `${prefix} ${amount}` : String(amount);
}

/**
 * Case-insensitive, number-aware comparator ("natural sort"): embedded
 * number sequences compare by value instead of lexicographically — both
 * digits ("Shop 2" before "Shop 10") and spelled-out words ("Shop Two"
 * before "Shop Ten"), so the comparator works regardless of which form the
 * underlying data uses.
 */
export function compareNatural(a: string, b: string): number {
  return normalizeTrailingNumberWords(a).localeCompare(normalizeTrailingNumberWords(b), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}
