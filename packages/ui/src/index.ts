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
export { isThemePreference, parseStoredTheme, resolveTheme, themeScriptSource } from './lib/theme';
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

export {
  BalanceAreaChart,
  type BalanceAreaChartProps,
  type BalancePoint,
} from './charts/balance-area-chart';
export { Gauge, gaugeRatio, type GaugeProps } from './charts/gauge';
export {
  IncomeExpenseChart,
  type IncomeExpenseChartProps,
  type IncomeExpensePeriod,
} from './charts/income-expense-chart';
export { KpiStatTile, type KpiStatTileProps } from './charts/kpi-stat-tile';
export { Sparkline, trendOf, type SparklineProps } from './charts/sparkline';
export {
  SpendDonutChart,
  type SpendDonutChartProps,
  type SpendSlice,
} from './charts/spend-donut-chart';
export {
  bucketTimeSeries,
  percentChange,
  resolveChartState,
  rollupCategories,
  slicePercents,
  BUCKET_GRANULARITIES,
  CHART_STATES,
  type BucketGranularity,
  type CategorySlice,
  type ChartState,
  type TimeBucket,
  type TimeSeriesPoint,
} from './charts/lib/aggregate';

export { ChatComposer } from './chat/chat-composer';
export { ChatMessageList } from './chat/chat-message-list';
export { ChatWidget, type ChatWidgetConnectResult } from './chat/chat-widget';
export {
  useChatSocket,
  type ChatSocketStatus,
  type UseChatSocketOptions,
  type UseChatSocketResult,
} from './chat/use-chat-socket';

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

export { AccountNumber, type AccountNumberProps } from './data/account-number';
export { Amount, type AmountProps } from './data/amount';
export { Balance, type BalanceProps } from './data/balance';
export { csvFilename, toCsv, toCsvCell, toCsvRow } from './data/csv';
export { DataTable, type ColumnDef, type DataTableProps } from './data/data-table';
export { tableToCsv } from './data/data-table-csv';
export { DefinitionList, type DefinitionItem, type DefinitionListProps } from './data/definition-list';
export { FilterBar, type FilterBarProps, type FilterDescriptor, type FilterOption } from './data/filter-bar';
export { Pagination, pageWindow, type PageItem, type PaginationProps } from './data/pagination';
export { SkeletonTable, SkeletonText, SkeletonTransactionList } from './data/skeletons';
export { StatusBadge, type StatusBadgeProps } from './data/status-badge';
export {
  STATUS_TONE_CLASSES,
  STATUS_TONES,
  statusLabel,
  statusTone,
  type StatusTone,
} from './data/status-badge.constants';
export { Timeline, type TimelineItem, type TimelineTone } from './data/timeline';
export {
  groupTransactionsByDay,
  TransactionList,
  type TransactionDayGroup,
  type TransactionListProps,
} from './data/transaction-list';
export { TransactionRow, type TransactionRowProps } from './data/transaction-row';

export { EmptyState } from './feedback/empty-state';
export { Skeleton } from './feedback/skeleton';

export { Calendar, type CalendarProps } from './form/calendar';
export { Checkbox, type CheckboxProps } from './form/checkbox';
export { filterOptions, firstEnabledOptionIndex, stepEnabledIndex } from './form/combo-utils';
export { Combobox, type ComboOption, type ComboboxProps } from './form/combobox';
export { DatePicker, type DatePickerProps } from './form/date-picker';
export {
  DateRangePicker,
  type DateRange,
  type DateRangePickerProps,
} from './form/date-range-picker';
export {
  addDays,
  addMonths,
  compareISODates,
  isIsoDisabled,
  isSameDay,
  monthGridDays,
  monthLabel,
  parseFlexibleDate,
  parseISODate,
  toISODate,
  weekdayLabels,
} from './form/date-utils';
export { Field, type FieldProps } from './form/field';
export { FileDropzone, type FileDropzoneProps } from './form/file-dropzone';
export {
  DEFAULT_MAX_FILES,
  formatFileSize,
  matchesAccept,
  validateFiles,
  type FileRejection,
  type FileRejectReason,
  type FileRules,
  type FileValidation,
} from './form/file-utils';
export { CONTROL_SIZES, FORM_COPY, type ControlSize } from './form/form.constants';
export { Input, type InputProps } from './form/input';
export { MoneyInput, type MoneyInputProps } from './form/money-input';
export { draftToMinorUnits, minorUnitsToDraft, sanitizeMoneyDraft } from './form/money-mask';
export { DEFAULT_OTP_LENGTH, isCompleteOtp, otpCells, otpFromPaste, setOtpCell } from './form/otp';
export { OTPInput, type OTPInputProps } from './form/otp-input';
export { PasswordInput, type PasswordInputProps } from './form/password-input';
export {
  PASSWORD_STRENGTH_LABELS,
  PASSWORD_STRENGTH_LEVELS,
  scorePassword,
  type PasswordStrength,
  type PasswordStrengthLevel,
} from './form/password-strength';
export {
  formatNationalNumber,
  isPossiblePhoneNumber,
  joinPhoneNumber,
  splitPhoneNumber,
  type PhoneParts,
} from './form/phone';
export { PhoneInput, type PhoneInputProps } from './form/phone-input';
export {
  DEFAULT_DIALING_CODES,
  E164_MAX_DIGITS,
  E164_MIN_DIGITS,
  type DialingCode,
} from './form/phone.constants';
export { RadioGroup, type RadioGroupProps, type RadioOption } from './form/radio-group';
export { Select, type SelectProps } from './form/select';
export { Slider, type SliderProps } from './form/slider';
export { Switch, type SwitchProps } from './form/switch';
export { Textarea, type TextareaProps } from './form/textarea';
export { useFieldA11y, useFieldState, type FieldA11y, type FieldState } from './form/use-field';

export { AppShell, type AppShellProps } from './layout/app-shell';
export { Breadcrumbs, type BreadcrumbItem } from './layout/breadcrumbs';
export { filterCommands, groupCommands, type CommandGroup, type FilterableCommand } from './layout/command-filter';
export { CommandPalette, type CommandItem, type CommandPaletteProps } from './layout/command-palette';
export { Container } from './layout/container';
export { Dialog, type DialogProps } from './layout/dialog';
export { Drawer, type DrawerProps } from './layout/drawer';
export { DropdownMenu, type DropdownMenuItem, type DropdownMenuProps } from './layout/dropdown-menu';
export { Grid, type GridCols, type GridProps } from './layout/grid';
export { KEYS, firstEnabledIndex, keyToRovingIntent, resolveRovingIndex, type RovingAxis, type RovingIntent, type RovingOptions } from './layout/keyboard';
export { FOCUSABLE_SELECTOR, Z_INDEX } from './layout/layout.constants';
export { PageHeader, type PageHeaderProps } from './layout/page-header';
export { Popover, type PopoverProps } from './layout/popover';
export { Reveal } from './layout/reveal';
export { Section, type SectionProps } from './layout/section';
export { Sheet, type SheetProps } from './layout/sheet';
export { Sidebar, type SidebarNavItem, type SidebarProps } from './layout/sidebar';
export { Stack, type StackGap, type StackProps } from './layout/stack';
export { Tabs, type TabItem, type TabsProps } from './layout/tabs';
export { Tooltip, type TooltipProps } from './layout/tooltip';
export { Topbar, type TopbarProps } from './layout/topbar';
export { useEscapeClose, useFocusTrap, useOutsidePointerDown, useScrollLock } from './layout/use-overlay';
