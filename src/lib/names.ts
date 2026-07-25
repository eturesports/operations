// Person-name casing. The source spreadsheet mixed "FRAN CORTIJO" with
// "Drew Berry", so names are normalized on the way in and on display.
//
// Rule: only rewrite words that carry no casing intent — all-caps ("CORTIJO")
// or all-lowercase ("courtney"). Words already in mixed case are left alone,
// which preserves McGlynn, O'Connor, Pi-Suyner and similar spellings.

// Suffixes/numerals that must stay uppercase.
const KEEP_UPPER = new Set(["II", "III", "IV", "V", "VI", "JR", "SR"]);

function capitalize(word: string): string {
  if (!word) return word;
  return word[0].toUpperCase() + word.slice(1).toLowerCase();
}

// Capitalize a single space-free token, handling Mc-, apostrophes and hyphens.
function fixToken(token: string): string {
  if (!token) return token;

  const upper = token.toUpperCase();
  if (KEEP_UPPER.has(upper.replace(/\.$/, ""))) return upper;

  // Hyphenated: Sanchez-Barbudo, Weston-Capulong
  if (token.includes("-")) {
    return token.split("-").map(fixToken).join("-");
  }

  // Apostrophes: O'Connor, D'Angelo (short prefix = Irish/Italian particle)
  const apos = token.match(/^([A-Za-zÀ-ÿ]{1,2})['’]([A-Za-zÀ-ÿ]+)$/);
  if (apos) {
    return `${capitalize(apos[1])}'${capitalize(apos[2])}`;
  }

  // Mc prefix: MCGLYNN -> McGlynn. ("Mac" is deliberately not special-cased —
  // Macias and Machado are ordinary words, not Scottish patronymics.)
  if (upper.length > 2 && upper.startsWith("MC")) {
    return "Mc" + capitalize(token.slice(2));
  }

  return capitalize(token);
}

// True when the word has no intentional casing (all caps or all lowercase).
function isShouty(word: string): boolean {
  const letters = word.replace(/[^A-Za-zÀ-ÿ]/g, "");
  if (!letters) return false;
  return letters === letters.toUpperCase() || letters === letters.toLowerCase();
}

/**
 * Normalize a person's name to "First Last" casing.
 * Already mixed-case words (McGlynn, O'Connor) are preserved as typed.
 */
export function normalizePersonName(raw: string): string {
  const collapsed = raw.replace(/\s+/g, " ").trim();
  if (!collapsed) return collapsed;

  return collapsed
    .split(" ")
    .map((word) => (isShouty(word) ? fixToken(word) : word))
    .join(" ");
}
