import type { CSSProperties, HTMLAttributes } from 'react';

import { cn } from '../lib/cn';

/** Two-dimensional layouts: card walls, form rows, KPI tiles. Gap comes from the token scale. */
export type GridCols = 1 | 2 | 3 | 4 | 6 | 12;

const COLS_CLASS: Record<GridCols, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  6: 'grid-cols-6',
  12: 'grid-cols-12',
};

const COLS_MD_CLASS: Record<GridCols, string> = {
  1: 'md:grid-cols-1',
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-4',
  6: 'md:grid-cols-6',
  12: 'md:grid-cols-12',
};

const COLS_LG_CLASS: Record<GridCols, string> = {
  1: 'lg:grid-cols-1',
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
  6: 'lg:grid-cols-6',
  12: 'lg:grid-cols-12',
};

interface GridOwnProps {
  cols?: GridCols;
  colsMd?: GridCols;
  colsLg?: GridCols;
  gap?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12;
}

export type GridProps = Readonly<HTMLAttributes<HTMLDivElement> & GridOwnProps>;

export function Grid({ cols = 1, colsMd, colsLg, gap = 4, className, style, ...props }: GridProps) {
  const gapStyle: CSSProperties = { gap: `var(--icb-space-${gap})`, ...style };
  return (
    <div
      className={cn(
        'grid',
        COLS_CLASS[cols],
        colsMd && COLS_MD_CLASS[colsMd],
        colsLg && COLS_LG_CLASS[colsLg],
        className,
      )}
      style={gapStyle}
      {...props}
    />
  );
}
