'use client';

import { cn, useTheme } from '@icb/ui';
import { Monitor, Moon, Sun } from 'lucide-react';

const OPTIONS = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] as const;

/**
 * Appearance. The choice persists to localStorage and applies to `<html>` immediately, so it
 * survives navigation without a round-trip. WCAG note: both themes are tuned in the shared
 * tokens, so the toggle never trades looks for contrast.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div role="radiogroup" aria-label="Appearance" className="flex gap-2">
      {OPTIONS.map((option) => {
        const active = theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(option.value)}
            className={cn(
              'flex flex-1 flex-col items-center gap-1.5 rounded-[var(--radius-md)] border px-3 py-3 text-sm font-medium transition-colors',
              active
                ? 'border-[var(--icb-primary)] bg-[var(--icb-navy-50)] text-[var(--icb-primary)]'
                : 'border-[var(--icb-border)] text-[var(--icb-text-muted)] hover:border-[var(--icb-border-strong)] hover:text-[var(--icb-text)]',
            )}
          >
            <option.icon size={17} aria-hidden="true" />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
