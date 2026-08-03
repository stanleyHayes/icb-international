import { nameSimilarity } from '../../kyc/domain/watchlist.js';
import { ADVERSE_MEDIA, ADVERSE_MEDIA_MATCH_FLOOR, type AdverseMediaEntry } from '../aml.constants.js';

/**
 * Adverse-media screening against the local list.
 *
 * Same matching discipline as the kyc watchlist — normalised fuzzy name matching, because real
 * screening has to survive transliteration and reordered name parts — over a fixed set of
 * fabricated subjects. There is no external news feed to call (N2), and a screening that only
 * works when a vendor is up is not a control.
 */
export interface AdverseMediaHit {
  readonly entry: AdverseMediaEntry;
  readonly similarity: number;
}

/** The strongest adverse-media match for a name, or null when the name draws no coverage. */
export function screenAdverseMedia(name: string): AdverseMediaHit | null {
  let best: AdverseMediaHit | null = null;

  for (const entry of ADVERSE_MEDIA) {
    const similarity = nameSimilarity(name, entry.name);
    if (similarity >= ADVERSE_MEDIA_MATCH_FLOOR && (best === null || similarity > best.similarity)) {
      best = { entry, similarity };
    }
  }

  return best;
}
