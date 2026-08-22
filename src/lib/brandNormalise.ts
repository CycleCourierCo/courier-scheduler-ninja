/**
 * Bike brand normalisation for analytics display.
 *
 * Free-text brand entry produces hundreds of near-duplicates ("TREK" vs "Trek"),
 * plus placeholder values that aren't brands at all ("Multiple bikes", "N/A").
 * This module collapses variants to a canonical key/label and filters placeholders.
 * It only affects display — stored order data is never rewritten.
 */

/** Values that mean "no brand recorded" rather than a real brand. */
const PLACEHOLDER_PATTERNS: RegExp[] = [
  /^$/,
  /^-+$/,
  /^n\/?a$/,
  /^none$/,
  /^null$/,
  /^undefined$/,
  /^unknown$/,
  /^unspecified$/,
  /^tbc$/,
  /^tba$/,
  /^other$/,
  /^misc(ellaneous)?$/,
  /^no brand$/,
  /^not specified$/,
  /^multiple( bikes?| items?)?$/,
  /^various( bikes?)?$/,
  /^(bike|bicycle|cycle|item|order|product|job)\s*\d*$/,
  /^\d+$/,
  /^\?+$/,
  /^test$/,
];

/**
 * Canonical labels keyed by their normalised comparison key.
 * Extend this table as new variants/misspellings show up in the data.
 */
const ALIASES: Record<string, string> = {
  specialized: "Specialized",
  specialised: "Specialized",
  spesialized: "Specialized",
  specialize: "Specialized",
  spec: "Specialized",
  trek: "Trek",
  treck: "Trek",
  trex: "Trek",
  giant: "Giant",
  gaint: "Giant",
  cube: "Cube",
  cannondale: "Cannondale",
  canondale: "Cannondale",
  cannodale: "Cannondale",
  canyon: "Canyon",
  cannyon: "Canyon",
  scott: "Scott",
  orbea: "Orbea",
  ribble: "Ribble",
  raleigh: "Raleigh",
  raliegh: "Raleigh",
  pashley: "Pashley",
  haibike: "Haibike",
  haybike: "Haibike",
  merida: "Merida",
  boardman: "Boardman",
  brompton: "Brompton",
  whyte: "Whyte",
  white: "Whyte",
  mondraker: "Mondraker",
  fiido: "Fiido",
  carrera: "Carrera",
  pinarello: "Pinarello",
  cervelo: "Cervelo",
  santacruz: "Santa Cruz",
  vitus: "Vitus",
  bianchi: "Bianchi",
  liv: "Liv",
  marin: "Marin",
  nukeproof: "Nukeproof",
  bmc: "BMC",
  gt: "GT",
  tenways: "Tenways",
  genesis: "Genesis",
  ridley: "Ridley",
  focus: "Focus",
  kona: "Kona",
  norco: "Norco",
  yeti: "Yeti",
  ktm: "KTM",
  bulls: "Bulls",
  riese: "Riese & Müller",
  riesemuller: "Riese & Müller",
  riesandmuller: "Riese & Müller",
  vanmoof: "VanMoof",
  cowboy: "Cowboy",
  engwe: "Engwe",
  synch: "Synch",
  shyre: "Shyre",
  velduro: "Velduro",
  islabikes: "Islabikes",
  frog: "Frog",
  dawes: "Dawes",
  ridgeback: "Ridgeback",
  saracen: "Saracen",
  voodoo: "Voodoo",
  apollo: "Apollo",
  claudbutler: "Claud Butler",
  bergamont: "Bergamont",
  lapierre: "Lapierre",
  lookcycles: "Look",
  look: "Look",
  colnago: "Colnago",
  wilier: "Wilier",
  argon18: "Argon 18",
  factor: "Factor",
  enve: "ENVE",
  rose: "Rose",
  stevens: "Stevens",
  bmw: "BMW",
  babboe: "Babboe",
  tern: "Tern",
  dahon: "Dahon",
  birdy: "Birdy",
  moulton: "Moulton",
};

/** Suffixes that add nothing to brand identity. */
const NOISE_SUFFIXES = [
  "bikes",
  "bike",
  "bicycles",
  "bicycle",
  "cycles",
  "cycling",
  "ebike",
  "ebikes",
  "ltd",
  "limited",
  "uk",
  "inc",
  "co",
];

const titleCase = (value: string) =>
  value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) =>
      word.length <= 3 && word === word.toUpperCase()
        ? word
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
    )
    .join(" ");

export interface CanonicalBrand {
  /** Stable comparison key used for aggregation. */
  key: string;
  /** Human-facing label. */
  label: string;
}

/**
 * Returns the canonical brand for a raw string, or `null` when the value is a
 * placeholder / not a usable brand.
 */
export const canonicalBrand = (raw: string | null | undefined): CanonicalBrand | null => {
  if (!raw) return null;

  // Trim, collapse whitespace, drop wrapping punctuation.
  let cleaned = String(raw)
    .replace(/[\u2018\u2019\u201c\u201d]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N})]+$/gu, "")
    .trim();

  if (!cleaned) return null;

  const lower = cleaned.toLowerCase();
  if (PLACEHOLDER_PATTERNS.some((re) => re.test(lower))) return null;

  // Strip trailing noise words ("Trek Bikes" -> "Trek").
  const words = cleaned.split(" ");
  while (words.length > 1) {
    const last = words[words.length - 1].toLowerCase().replace(/[^a-z0-9]/g, "");
    if (NOISE_SUFFIXES.includes(last)) {
      words.pop();
      continue;
    }
    break;
  }
  cleaned = words.join(" ");

  const key = cleaned.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!key) return null;
  if (PLACEHOLDER_PATTERNS.some((re) => re.test(key))) return null;

  const label = ALIASES[key] ?? titleCase(cleaned);
  return { key, label };
};
