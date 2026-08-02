/**
 * The local sanctions / PEP list.
 *
 * ICB never calls an external screening bureau: a simulation that depends on a paid third party
 * is a simulation that stops working. Every name below is fabricated. Any resemblance to a real
 * person or entity is coincidental, and the programme codes are deliberately obvious fictions
 * (`ICB-SIM-*`) so that nobody can mistake this file for a real sanctions extract.
 *
 * Matching is fuzzy on purpose. Real screening never compares strings for equality — it has to
 * survive transliteration, reordered name parts, missing middle names and diacritics — so this
 * normalises aggressively and then scores an edit distance.
 */

export type WatchlistKind = 'sanctions' | 'pep';

export interface WatchlistEntry {
  readonly name: string;
  readonly kind: WatchlistKind;
  readonly programme: string;
  readonly country: string;
}

export interface WatchlistHit {
  readonly entry: WatchlistEntry;
  /** 0–1, where 1 is an exact match on the normalised name. */
  readonly similarity: number;
}

export const WATCHLIST: readonly WatchlistEntry[] = [
  { name: 'Viktor Anatoly Rusanov', kind: 'sanctions', programme: 'ICB-SIM-NPWMD', country: 'RU' },
  { name: 'Dmitri Kolchak Vasnev', kind: 'sanctions', programme: 'ICB-SIM-NPWMD', country: 'BY' },
  { name: 'Hassan Al-Muktadir', kind: 'sanctions', programme: 'ICB-SIM-SDGT', country: 'SY' },
  { name: 'Farida Nasrallah Qadir', kind: 'sanctions', programme: 'ICB-SIM-SDGT', country: 'LB' },
  { name: 'Emmanuel Kofi Danquah-Brew', kind: 'sanctions', programme: 'ICB-SIM-NARCO', country: 'GH' },
  { name: 'Rosalia Ximena Berrocal', kind: 'sanctions', programme: 'ICB-SIM-NARCO', country: 'CO' },
  { name: 'Nikolai Petrovich Zvonarev', kind: 'sanctions', programme: 'ICB-SIM-CYBER', country: 'RU' },
  { name: 'Chen Wei Ling Tsao', kind: 'sanctions', programme: 'ICB-SIM-CYBER', country: 'CN' },
  { name: 'Ibrahim Sesay Kamara', kind: 'sanctions', programme: 'ICB-SIM-BLOOD', country: 'SL' },
  { name: 'Miroslav Danilo Vukovic', kind: 'sanctions', programme: 'ICB-SIM-WARCRIME', country: 'RS' },
  { name: 'Adaeze Chinwe Okonkwo-Bright', kind: 'pep', programme: 'ICB-SIM-PEP-CABINET', country: 'NG' },
  { name: 'Thabo Sipho Mokoena', kind: 'pep', programme: 'ICB-SIM-PEP-CABINET', country: 'ZA' },
  { name: 'Rafael Domingo Escalante', kind: 'pep', programme: 'ICB-SIM-PEP-HEADOFSTATE', country: 'VE' },
  { name: 'Ludmila Katerina Voronina', kind: 'pep', programme: 'ICB-SIM-PEP-JUDICIARY', country: 'UA' },
  { name: 'Abdoulaye Mamadou Diarra', kind: 'pep', programme: 'ICB-SIM-PEP-MILITARY', country: 'ML' },
  { name: 'Priya Anjali Ramanathan', kind: 'pep', programme: 'ICB-SIM-PEP-CENTRALBANK', country: 'IN' },
  { name: 'Georgios Stavros Papandreou-Lekas', kind: 'pep', programme: 'ICB-SIM-PEP-LEGISLATURE', country: 'GR' },
  { name: 'Marisol Beatriz Ferreira-Lund', kind: 'pep', programme: 'ICB-SIM-PEP-SOE', country: 'BR' },
  { name: 'Yusuf Baris Demirkol', kind: 'pep', programme: 'ICB-SIM-PEP-LEGISLATURE', country: 'TR' },
  { name: 'Helena Margrethe Lindqvist', kind: 'pep', programme: 'ICB-SIM-PEP-DIPLOMATIC', country: 'SE' },
];

/** Below this, two names are simply different people. */
const MATCH_FLOOR = 0.7;
/** At or above this, treat the hit as the same person and block. */
export const STRONG_MATCH = 0.9;
/** Between the floor and a strong match, a human decides. */
export const WEAK_MATCH = 0.78;

/**
 * Normalise for comparison: strip diacritics and punctuation, fold case, and sort the name
 * parts so that "Okonkwo, Adaeze" and "Adaeze Okonkwo" are the same string.
 */
export function normaliseName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 0)
    .sort((left, right) => left.localeCompare(right))
    .join(' ');
}

/** Levenshtein distance, two-row variant so memory stays proportional to the shorter name. */
function editDistance(left: string, right: string): number {
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let row = 1; row <= left.length; row += 1) {
    const current: number[] = [row];
    for (let column = 1; column <= right.length; column += 1) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1;
      current[column] = Math.min(
        (previous[column - 1] ?? 0) + cost,
        (current[column - 1] ?? 0) + 1,
        (previous[column] ?? 0) + 1,
      );
    }
    previous = current;
  }

  return previous[right.length] ?? 0;
}

/** 0–1 similarity of two raw names, after normalisation. */
export function nameSimilarity(left: string, right: string): number {
  const a = normaliseName(left);
  const b = normaliseName(right);

  if (a.length === 0 || b.length === 0) {
    return 0;
  }
  if (a === b) {
    return 1;
  }

  const longest = Math.max(a.length, b.length);
  return Math.max(0, 1 - editDistance(a, b) / longest);
}

/** The strongest hit for a name on one of the two lists, or null when the name is clean. */
export function screenName(name: string, kind: WatchlistKind): WatchlistHit | null {
  let best: WatchlistHit | null = null;

  for (const entry of WATCHLIST) {
    if (entry.kind !== kind) {
      continue;
    }
    const similarity = nameSimilarity(name, entry.name);
    if (similarity >= MATCH_FLOOR && (best === null || similarity > best.similarity)) {
      best = { entry, similarity };
    }
  }

  return best;
}
