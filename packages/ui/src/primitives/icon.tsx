import type { ReactNode } from 'react';

import { cn } from '../lib/cn';

/**
 * Icon grid and stroke.
 *
 * Every glyph in the set is drawn on a 24×24 viewBox with a 1.5 stroke, round caps and joins,
 * and inherits `currentColor` — size and colour come from the surrounding UI, never the glyph.
 */
export const ICON_SIZES = { sm: 16, md: 20, lg: 24 } as const;
export type IconSize = keyof typeof ICON_SIZES;
export const ICON_GRID = 24;
export const ICON_STROKE_WIDTH = 1.5;

export interface IconProps {
  /** Named grid size, or an explicit pixel size for one-off alignment. Defaults to `md` (20px). */
  size?: IconSize | number;
  /**
   * Accessible name. Omit for decorative icons (the default — an icon next to a label must not
   * be announced twice); set it only when the icon alone carries meaning, e.g. an icon button.
   */
  label?: string;
  /** Defaults to the grid's 1.5; override only to match adjacent custom artwork. */
  strokeWidth?: number;
  className?: string;
  children: ReactNode;
}

/** The shared SVG shell every glyph renders through. */
export function Icon({
  size = 'md',
  label,
  strokeWidth = ICON_STROKE_WIDTH,
  className,
  children,
}: Readonly<IconProps>) {
  const px = typeof size === 'number' ? size : ICON_SIZES[size];
  const a11y = label
    ? ({ role: 'img', 'aria-label': label } as const)
    : ({ 'aria-hidden': true, focusable: false } as const);
  return (
    <svg
      width={px}
      height={px}
      viewBox={`0 0 ${ICON_GRID} ${ICON_GRID}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('shrink-0', className)}
      {...a11y}
    >
      {children}
    </svg>
  );
}

export type GlyphProps = Omit<IconProps, 'children'>;

/**
 * Bind path data to the shared shell. Each glyph is a standalone named export, so bundlers
 * tree-shake the set down to the icons an app actually uses.
 */
export function createGlyph(displayName: string, content: ReactNode) {
  function Glyph(props: GlyphProps) {
    return <Icon {...props}>{content}</Icon>;
  }
  Glyph.displayName = displayName;
  return Glyph;
}
