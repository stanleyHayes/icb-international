import { useId } from 'react';

import { PATTERN_STROKE, PATTERN_STROKE_WIDTH, PATTERN_TILE } from './chart.constants';

const HALF_TILE = PATTERN_TILE / 2;
const DOT_RADIUS = 1.5;

const PATTERN_KINDS = [
  'solid',
  'diag',
  'dots',
  'grid',
  'diag-rev',
  'vertical',
  'cross',
  'horizontal',
] as const;
type PatternKind = (typeof PATTERN_KINDS)[number];

/** Deterministic line segments per hatch kind, in tile coordinates. */
const HATCH_LINES: Record<Exclude<PatternKind, 'solid' | 'dots'>, readonly [number, number, number, number][]> = {
  diag: [[0, PATTERN_TILE, PATTERN_TILE, 0]],
  'diag-rev': [[0, 0, PATTERN_TILE, PATTERN_TILE]],
  vertical: [[HALF_TILE, 0, HALF_TILE, PATTERN_TILE]],
  horizontal: [[0, HALF_TILE, PATTERN_TILE, HALF_TILE]],
  grid: [
    [0, HALF_TILE, PATTERN_TILE, HALF_TILE],
    [HALF_TILE, 0, HALF_TILE, PATTERN_TILE],
  ],
  cross: [
    [0, PATTERN_TILE, PATTERN_TILE, 0],
    [0, 0, PATTERN_TILE, PATTERN_TILE],
  ],
};

/**
 * One texture per categorical slot. Slot 0 is solid colour; the rest overlay a distinct hatch,
 * so adjacent slices read apart without relying on hue alone (WCAG 1.4.1 — never colour alone).
 */
export function useChartPatterns(): { prefix: string; fillFor: (index: number) => string } {
  const prefix = useId().replaceAll(':', '');
  return { prefix, fillFor: (index) => `url(#${patternId(prefix, index)})` };
}

export function patternId(prefix: string, index: number): string {
  return `${prefix}-p${index % PATTERN_KINDS.length}`;
}

function PatternTexture({ kind }: Readonly<{ kind: PatternKind }>) {
  if (kind === 'solid') return null;
  if (kind === 'dots') {
    return <circle cx={HALF_TILE} cy={HALF_TILE} r={DOT_RADIUS} fill={PATTERN_STROKE} />;
  }
  return (
    <>
      {HATCH_LINES[kind].map(([x1, y1, x2, y2]) => (
        <line
          key={`${x1}-${y1}-${x2}-${y2}`}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={PATTERN_STROKE}
          strokeWidth={PATTERN_STROKE_WIDTH}
        />
      ))}
    </>
  );
}

/** The pattern `<defs>` block; render once inside each chart `<svg>`. */
export function ChartPatterns({ prefix, count }: Readonly<{ prefix: string; count: number }>) {
  return (
    <defs>
      {Array.from({ length: count }, (_, index) => (
        <pattern
          key={patternId(prefix, index)}
          id={patternId(prefix, index)}
          width={PATTERN_TILE}
          height={PATTERN_TILE}
          patternUnits="userSpaceOnUse"
        >
          <PatternTexture kind={PATTERN_KINDS[index % PATTERN_KINDS.length] ?? 'solid'} />
        </pattern>
      ))}
    </defs>
  );
}
