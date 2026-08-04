/**
 * Shared layout constants.
 *
 * One stacking scale for every overlay the design system ships: a dropdown under a dialog,
 * a tooltip above both. Components read these instead of inventing `z-*` values, so layers
 * never fight.
 */
export const Z_INDEX = {
  dropdown: 40,
  overlay: 50,
  tooltip: 60,
} as const;

/** DOM query for elements that may receive keyboard focus inside an overlay. */
export const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
