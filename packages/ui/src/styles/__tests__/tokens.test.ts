import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * The brand tokens exist in three places: the design source of truth under `brand/`, and a copy
 * beside each consumer (`@icb/ui` for components, `@icb/config-tailwind` for the Tailwind preset).
 * Nothing generates the copies, so they are only as correct as the last person to remember them —
 * and they had already drifted, which is how an accessibility fix in `brand/` reached neither app.
 *
 * This is the guard: change `brand/tokens/tokens.css`, copy it to both, or this fails.
 */
const REPO_ROOT = resolve(import.meta.dirname, '../../../../..');

const SOURCE = 'brand/tokens/tokens.css';
const COPIES = ['packages/ui/src/styles/tokens.css', 'packages/config-tailwind/tokens.css'];

const read = (relative: string): string => readFileSync(resolve(REPO_ROOT, relative), 'utf8');

describe('brand token copies', () => {
  it.each(COPIES)('%s is byte-identical to the brand source', (copy) => {
    expect(read(copy), `${copy} has drifted from ${SOURCE} — copy it across`).toBe(read(SOURCE));
  });
});

/**
 * WCAG 2.2 AA: 4.5:1 for normal text. These pairs are the ones axe caught rendering below it —
 * gold-500 as body text measured 2.42:1 — so they are pinned here rather than left to be
 * rediscovered by a browser run that only happens in CI.
 */
describe('text tokens meet WCAG AA on their own surface', () => {
  const tokens = read(SOURCE);

  // The dark block is everything after the `prefers-color-scheme: dark` / [data-theme] marker.
  const darkAt = tokens.search(/data-theme=['"]dark['"]|prefers-color-scheme:\s*dark/);

  /** One declaration per line, split rather than matched — no backtracking to reason about. */
  function declarationsIn(region: string): Map<string, string> {
    const found = new Map<string, string>();
    for (const line of region.split('\n')) {
      const text = line.trim();
      if (!text.startsWith('--icb-')) continue;
      const colon = text.indexOf(':');
      const semicolon = text.lastIndexOf(';');
      if (colon === -1 || semicolon <= colon) continue;
      // Last declaration wins, mirroring the cascade.
      found.set(text.slice(0, colon), text.slice(colon + 1, semicolon).trim());
    }
    return found;
  }

  const LIGHT = declarationsIn(tokens.slice(0, darkAt));
  const DARK = declarationsIn(tokens.slice(darkAt));

  /**
   * Resolve a `--icb-*` custom property to a hex literal.
   *
   * Dark reads its own block first and falls back to `:root`: the dark theme overrides only the
   * semantic tokens, and still points at the one palette scale declared up top.
   */
  function hexOf(name: string, scope: 'light' | 'dark'): string {
    const found = scope === 'dark' ? (DARK.get(name) ?? LIGHT.get(name)) : LIGHT.get(name);
    if (!found) throw new Error(`${name} is not declared in the ${scope} theme`);
    const indirect = /^var\((--icb-[\w-]+)\)$/.exec(found);
    return indirect ? hexOf(indirect[1] as string, scope) : found;
  }

  function relativeLuminance(hex: string): number {
    const channels = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255);
    const linear = channels.map((c) => (c <= 0.040_45 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * (linear[0] ?? 0) + 0.7152 * (linear[1] ?? 0) + 0.0722 * (linear[2] ?? 0);
  }

  function contrast(foreground: string, background: string): number {
    const [a, b] = [relativeLuminance(foreground), relativeLuminance(background)];
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  }

  const CASES = [
    { scope: 'light' as const, fg: '--icb-accent-text', bg: '--icb-bg' },
    { scope: 'light' as const, fg: '--icb-text-subtle', bg: '--icb-bg' },
    { scope: 'light' as const, fg: '--icb-text-muted', bg: '--icb-bg' },
    { scope: 'light' as const, fg: '--icb-text', bg: '--icb-bg' },
    { scope: 'dark' as const, fg: '--icb-accent-text', bg: '--icb-bg' },
    { scope: 'dark' as const, fg: '--icb-text-muted', bg: '--icb-bg' },
    { scope: 'dark' as const, fg: '--icb-text', bg: '--icb-bg' },
  ];

  it.each(CASES)('$fg on $bg ($scope) clears 4.5:1', ({ scope, fg, bg }) => {
    const ratio = contrast(hexOf(fg, scope), hexOf(bg, scope));
    expect(ratio, `${fg} on ${bg} (${scope}) is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
  });
});
