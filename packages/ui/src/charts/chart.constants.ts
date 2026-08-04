/**
 * Chart constants.
 *
 * The categorical palette mirrors `brand/tokens/colors.json` → `chart.categorical` (DS-00).
 * tokens.css is generated from that JSON and carries no categorical CSS custom properties yet,
 * so the hexes are mirrored here; when DS-01 emits `--icb-chart-*` vars this file switches to
 * them. Do not invent new chart colours — extend the brand JSON instead.
 */
export const CHART_CATEGORICAL_COLORS = [
  '#0F4C81',
  '#C9A227',
  '#0E9F6E',
  '#1A6DB0',
  '#A5831C',
  '#6E99C2',
  '#84E1BC',
  '#E0BC4B',
] as const;

/** Semantic series colours — drawn from the token palette, not the categorical scale. */
export const CHART_SERIES_COLORS = {
  balance: '#0F4C81',
  income: '#0E9F6E',
  expense: '#41505E',
  gaugeTrack: '#DFE6ED',
} as const;

/** Pattern hatch overlay drawn on top of a solid slice colour (white, half-strength). */
export const PATTERN_STROKE = 'rgba(255, 255, 255, 0.6)';
export const PATTERN_STROKE_WIDTH = 2;
export const PATTERN_TILE = 8;

export const CHART_VIEWBOX_WIDTH = 640;
export const CHART_DEFAULT_HEIGHT = 240;
export const SPARKLINE_WIDTH = 120;
export const SPARKLINE_HEIGHT = 36;
export const GAUGE_WIDTH = 240;
export const GAUGE_HEIGHT = 140;
export const DONUT_SIZE = 200;
export const DONUT_THICKNESS = 28;

export const AXIS_TICK_COUNT = 4;
export const AREA_PAD_X = 8;
export const AREA_PAD_TOP = 12;
export const AREA_PAD_BOTTOM = 24;
export const AREA_PAD_LEFT = 56;
export const BAR_PAD_X = 32;
export const BAR_PAD_TOP = 20;
export const BAR_PAD_BOTTOM = 24;
export const BAR_GROUP_GAP_RATIO = 0.3;
export const BAR_INNER_GAP = 4;

export const MAX_DONUT_SLICES = 6;
export const OTHER_CATEGORY_LABEL = 'Other';

/** Full circle in degrees; donut slices start at twelve o'clock. */
export const FULL_CIRCLE_DEGREES = 360;
export const GAUGE_START_DEGREES = -90;
export const GAUGE_SWEEP_DEGREES = 180;
export const PERCENT_BASE = 100;

export const CHART_EMPTY_TITLE = 'Nothing to chart yet';
export const CHART_EMPTY_DESCRIPTION = 'Data will appear here once there is activity.';
