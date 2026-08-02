import { themeScriptSource } from '../lib/theme';

/**
 * Blocking theme bootstrap for Next.js App Router root layouts.
 *
 * Render it inside `<head>` (before any stylesheet-dependent paint) and put
 * `suppressHydrationWarning` on `<html>` — the script mutates `data-theme` before hydration,
 * so the server-rendered and client DOM intentionally differ on that attribute:
 *
 * ```tsx
 * <html lang="en" suppressHydrationWarning>
 *   <head>
 *     <ThemeScript />
 *   </head>
 *   …
 * ```
 *
 * Inline and synchronous: no network round-trip, no flash of the wrong theme.
 */
export function ThemeScript() {
  return (
    <script
      id="icb-theme-init"
      dangerouslySetInnerHTML={{ __html: themeScriptSource() }}
      suppressHydrationWarning
    />
  );
}
