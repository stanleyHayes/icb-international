/**
 * Share of the limit at which a budget counts as "approaching" (spent ≥ 80% of the limit).
 * Compared in integer per-mille so no floating point sneaks into the verdict.
 */
export const APPROACHING_THRESHOLD_PER_MILLE = 800;
