import type { CSSProperties, HTMLAttributes } from 'react';

import { cn } from '../lib/cn';

/**
 * The page column. Centres content and caps its width at the brand container tokens —
 * `--icb-container` for reading/management views, `--icb-container-wide` for dense consoles.
 */
export function Container({
  wide = false,
  className,
  style,
  ...props
}: Readonly<HTMLAttributes<HTMLDivElement> & { wide?: boolean }>) {
  const maxWidth: CSSProperties = {
    maxWidth: wide ? 'var(--icb-container-wide)' : 'var(--icb-container)',
    ...style,
  };
  return (
    <div
      className={cn('mx-auto w-full px-4 sm:px-6 lg:px-8', className)}
      style={maxWidth}
      {...props}
    />
  );
}
