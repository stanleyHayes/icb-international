// ─── @icb/ui barrel — agents append one export line per module, alphabetically by path ───
export { cn } from './lib/cn';
export { cva, cx, type VariantProps } from './lib/cva';
export {
  formatDate,
  formatMoney,
  formatRelativeDay,
  formatTime,
  groupIdentifier,
  initialsOf,
  maskIdentifier,
  splitMoney,
  type MoneyLike,
} from './lib/format';
export {
  isThemePreference,
  parseStoredTheme,
  resolveTheme,
  themeScriptSource,
} from './lib/theme';
export {
  DEFAULT_THEME_PREFERENCE,
  THEME_ATTRIBUTE,
  THEME_MEDIA_QUERY,
  THEME_PREFERENCES,
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type ThemePreference,
} from './lib/theme.constants';
export { MissingThemeProviderError } from './lib/theme.errors';

export { Button, type ButtonProps } from './primitives/button';
export { Card, CardBody, CardFooter, CardHeader } from './primitives/card';
export {
  Icon,
  ICON_GRID,
  ICON_SIZES,
  ICON_STROKE_WIDTH,
  type GlyphProps,
  type IconProps,
  type IconSize,
} from './primitives/icon';
export {
  IconAccounts,
  IconAlert,
  IconCards,
  IconChart,
  IconCheck,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconChevronUp,
  IconClose,
  IconDownload,
  IconEye,
  IconEyeOff,
  IconFilter,
  IconLoans,
  IconLock,
  IconLogout,
  IconMenu,
  IconPayments,
  IconPlus,
  IconSavings,
  IconSearch,
  IconTransfers,
  IconUser,
} from './primitives/icons';
export { IcbLogo, IcbMark } from './primitives/logo';
export { ThemeProvider, useTheme } from './primitives/theme-provider';
export { ThemeScript } from './primitives/theme-script';

export { Amount, type AmountProps } from './data/amount';
export { StatusBadge } from './data/status-badge';

export { EmptyState } from './feedback/empty-state';
export { Skeleton } from './feedback/skeleton';
