/**
 * Pure chart geometry: scales, ticks, and SVG path builders.
 * No DOM, no React — every function is unit-tested in isolation.
 */

export interface XY {
  x: number;
  y: number;
}

export interface YDomain {
  min: number;
  max: number;
  height: number;
  pad: number;
}

/** Inclusive [min, max] of a numeric series; [0, 0] for an empty one. */
export function extent(values: readonly number[]): readonly [number, number] {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const value of values) {
    if (value < min) min = value;
    if (value > max) max = value;
  }
  return values.length === 0 ? [0, 0] : [min, max];
}

/** Round step (1/2/5 × 10ⁿ) so axis ticks land on human-readable numbers. */
function niceStep(rawStep: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const residual = rawStep / magnitude;
  if (residual >= 5) return 5 * magnitude;
  if (residual >= 2) return 2 * magnitude;
  return magnitude;
}

/** `count` ticks from zero up to (at least) `max`, on round boundaries. */
export function niceTicks(max: number, count: number): number[] {
  if (max <= 0 || count < 2) return [0, Math.max(max, 1)];
  const step = niceStep(max / (count - 1));
  const ticks: number[] = [];
  for (let value = 0; value <= max + step / 2; value += step) {
    ticks.push(Math.round(value / step) * step);
  }
  return ticks;
}

/** Evenly-spaced x for point `index` of `count`, inset by `pad` on both sides. */
export function xPosition(index: number, count: number, width: number, pad: number): number {
  if (count <= 1) return width / 2;
  const inner = width - pad * 2;
  return pad + (index / (count - 1)) * inner;
}

/** Y for `value` within the domain, inset by `pad`; SVG y grows downward. */
export function yPosition(value: number, domain: YDomain): number {
  const { min, max, height, pad } = domain;
  const span = max - min;
  const ratio = span === 0 ? 0 : (value - min) / span;
  return height - pad - ratio * (height - pad * 2);
}

function toPath(points: readonly XY[], close: boolean): string {
  const [first, ...rest] = points;
  if (!first) return '';
  const segments = rest.map((p) => `L${round(p.x)},${round(p.y)}`).join('');
  return `M${round(first.x)},${round(first.y)}${segments}${close ? 'Z' : ''}`;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Polyline path through the points. */
export function linePath(points: readonly XY[]): string {
  return toPath(points, false);
}

/** Closed area path: along the points, then down to `baselineY` and back. */
export function areaPath(points: readonly XY[], baselineY: number): string {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return '';
  const spine = toPath(points, false);
  return `${spine}L${round(last.x)},${round(baselineY)}L${round(first.x)},${round(baselineY)}Z`;
}

/** Point on a circle; angle in degrees, 0° at twelve o'clock, clockwise. */
export function polarToCartesian(center: XY, radius: number, degrees: number): XY {
  const radians = ((degrees - 90) * Math.PI) / 180;
  return { x: center.x + radius * Math.cos(radians), y: center.y + radius * Math.sin(radians) };
}

/** Open arc path from `startDegrees` to `endDegrees` (clockwise, ≤180°). */
export function arcPath(center: XY, radius: number, startDegrees: number, endDegrees: number): string {
  const start = polarToCartesian(center, radius, endDegrees);
  const end = polarToCartesian(center, radius, startDegrees);
  const largeArc = endDegrees - startDegrees <= 180 ? 0 : 1;
  return `M${round(start.x)},${round(start.y)}A${radius},${radius} 0 ${largeArc} 0 ${round(end.x)},${round(end.y)}`;
}

/** Closed donut segment (annulus slice) between two angles. */
export function donutSegmentPath(
  center: XY,
  radii: { outer: number; inner: number },
  startDegrees: number,
  endDegrees: number,
): string {
  const { outer, inner } = radii;
  const fullCircle = endDegrees - startDegrees >= 360;
  const outerEnd = fullCircle ? endDegrees - 0.01 : endDegrees;
  const largeArc = outerEnd - startDegrees <= 180 ? 0 : 1;
  const outerStart = polarToCartesian(center, outer, startDegrees);
  const outerStop = polarToCartesian(center, outer, outerEnd);
  const innerStop = polarToCartesian(center, inner, outerEnd);
  const innerStart = polarToCartesian(center, inner, startDegrees);
  return [
    `M${round(outerStart.x)},${round(outerStart.y)}`,
    `A${outer},${outer} 0 ${largeArc} 1 ${round(outerStop.x)},${round(outerStop.y)}`,
    `L${round(innerStop.x)},${round(innerStop.y)}`,
    `A${inner},${inner} 0 ${largeArc} 0 ${round(innerStart.x)},${round(innerStart.y)}`,
    'Z',
  ].join('');
}
