/**
 * Theme system constants.
 *
 * The inline boot script (see `theme.ts`), the React provider, and any app shell all read from
 * these values so the storage key, attribute, and media query can never drift apart.
 */

/** Attribute set on `<html>`; `tokens.css` scopes the dark theme to `[data-theme="dark"]`. */
export const THEME_ATTRIBUTE = 'data-theme';

/** localStorage key holding the user's explicit choice. */
export const THEME_STORAGE_KEY = 'icb-theme';

/** System appearance query used when the preference is `system`. */
export const THEME_MEDIA_QUERY = '(prefers-color-scheme: dark)';

export const THEME_PREFERENCES = ['light', 'dark', 'system'] as const;

/** What the user picked: an explicit theme, or follow the OS. */
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

/** What actually renders — `system` never reaches the DOM. */
export type ResolvedTheme = 'light' | 'dark';

/** With no stored choice, the theme follows the OS rather than forcing light. */
export const DEFAULT_THEME_PREFERENCE: ThemePreference = 'system';
