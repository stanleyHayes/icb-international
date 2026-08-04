import { ThemeProvider, ThemeScript } from '@icb/ui';
import type { ReactNode } from 'react';

import { SettingsNav } from '@/features/settings/settings-nav';

/**
 * Settings shell: section tabs plus the theme context the appearance toggle in Preferences
 * writes to. The provider sets `data-theme` on `<html>`, so the choice applies app-wide; the
 * script here removes the flash for the settings routes themselves, and persisting across all
 * routes only needs the same script added to the root layout (owned by the shell mission).
 */
export default function SettingsLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <ThemeProvider>
      <ThemeScript />
      <SettingsNav />
      {children}
    </ThemeProvider>
  );
}
