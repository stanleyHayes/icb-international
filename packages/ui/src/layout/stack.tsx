import type { CSSProperties, HTMLAttributes } from 'react';

import { cn } from '../lib/cn';

/**
 * One-dimensional rhythm.
 *
 * Stack owns the spacing between siblings so screens never hand-tune margins per element.
 * The gap scale is the 4pt brand token scale, not arbitrary pixels.
 */
export type StackGap = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12 | 16 | 20 | 24;

type StackAlign = 'start' | 'center' | 'end' | 'stretch' | 'baseline';
type StackJustify = 'start' | 'center' | 'end' | 'between' | 'around';

const ALIGN_CLASS: Record<StackAlign, string> = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
  baseline: 'items-baseline',
};

const JUSTIFY_CLASS: Record<StackJustify, string> = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
  around: 'justify-around',
};

interface StackOwnProps {
  direction?: 'row' | 'column';
  gap?: StackGap;
  align?: StackAlign;
  justify?: StackJustify;
  wrap?: boolean;
}

export type StackProps = Readonly<HTMLAttributes<HTMLDivElement> & StackOwnProps>;

export function Stack({
  direction = 'column',
  gap = 4,
  align = 'stretch',
  justify = 'start',
  wrap = false,
  className,
  style,
  ...props
}: StackProps) {
  const gapStyle: CSSProperties = { gap: `var(--icb-space-${gap})`, ...style };
  return (
    <div
      className={cn(
        'flex',
        direction === 'row' ? 'flex-row' : 'flex-col',
        ALIGN_CLASS[align],
        JUSTIFY_CLASS[justify],
        wrap && 'flex-wrap',
        className,
      )}
      style={gapStyle}
      {...props}
    />
  );
}
