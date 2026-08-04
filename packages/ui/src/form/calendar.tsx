'use client';

import { useId, useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';

import { cn } from '../lib/cn';
import { IconChevronLeft, IconChevronRight } from '../primitives/icons';
import {
  addDays,
  addMonths,
  compareISODates,
  DAYS_IN_WEEK,
  isIsoDisabled,
  monthGridDays,
  monthLabel,
  parseISODate,
  toISODate,
  weekdayLabels,
} from './date-utils';
import { FORM_COPY } from './form.constants';

export interface CalendarProps {
  /** The visible month; only its month and year are read. */
  readonly month: Date;
  readonly onMonthChange: (month: Date) => void;
  readonly onSelect: (iso: string) => void;
  readonly selectedIso?: string | null | undefined;
  readonly rangeStartIso?: string | null | undefined;
  readonly rangeEndIso?: string | null | undefined;
  readonly minIso?: string | undefined;
  readonly maxIso?: string | undefined;
  readonly locale?: string | undefined;
}

/** The calendar trigger glyph shared by the date pickers (the icon set has no calendar yet). */
export function CalendarGlyph() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 9.5h17" />
      <path d="M8 3v4M16 3v4" />
    </svg>
  );
}

function dayMove(key: string, date: Date): Date | null {
  const mondayOffset = (date.getDay() + DAYS_IN_WEEK - 1) % DAYS_IN_WEEK;
  switch (key) {
    case 'ArrowLeft':
      return addDays(date, -1);
    case 'ArrowRight':
      return addDays(date, 1);
    case 'ArrowUp':
      return addDays(date, -DAYS_IN_WEEK);
    case 'ArrowDown':
      return addDays(date, DAYS_IN_WEEK);
    case 'Home':
      return addDays(date, -mondayOffset);
    case 'End':
      return addDays(date, DAYS_IN_WEEK - 1 - mondayOffset);
    default:
      return null;
  }
}

function resolveMove(key: string, shiftKey: boolean, date: Date): Date | null {
  if (key === 'PageUp') {
    return addMonths(date, shiftKey ? -12 : -1);
  }
  if (key === 'PageDown') {
    return addMonths(date, shiftKey ? 12 : 1);
  }
  return dayMove(key, date);
}

interface DayState {
  readonly selected: boolean;
  readonly inRange: boolean;
}

function dayState(
  iso: string,
  selectedIso: string | null | undefined,
  startIso: string | null | undefined,
  endIso: string | null | undefined,
): DayState {
  const selected = iso === selectedIso || iso === startIso || iso === endIso;
  const inRange =
    startIso != null &&
    endIso != null &&
    compareISODates(iso, startIso) >= 0 &&
    compareISODates(iso, endIso) <= 0;
  return { selected, inRange };
}

const DAY_BASE_CLASSES =
  'flex h-9 w-full items-center justify-center rounded-full text-sm transition-colors duration-100';

function dayClasses(day: Date, month: Date, todayIso: string, state: DayState): string {
  return cn(
    DAY_BASE_CLASSES,
    day.getMonth() === month.getMonth()
      ? 'text-[var(--icb-text)]'
      : 'text-[var(--icb-text-subtle)]',
    toISODate(day) === todayIso && 'font-semibold ring-1 ring-inset ring-[var(--icb-border-strong)]',
    !state.selected && !state.inRange && 'hover:bg-[var(--icb-bg-muted)]',
    state.inRange && !state.selected && 'rounded-none bg-[var(--icb-primary-subtle)]',
    state.selected && 'bg-[var(--icb-primary)] text-[var(--icb-text-on-brand)]',
    'disabled:cursor-not-allowed disabled:opacity-40',
    'focus-visible:outline-none focus-visible:focus-ring-inset',
  );
}

/**
 * The month grid shared by DatePicker and DateRangePicker. Implements the APG date-grid
 * keyboard contract: arrows move by day/week, Home/End by week edge, PageUp/Down by month
 * (a year with Shift), Enter/Space selects. Focus is roving — one tab stop for the grid.
 */
export function Calendar({
  month,
  onMonthChange,
  onSelect,
  selectedIso,
  rangeStartIso,
  rangeEndIso,
  minIso,
  maxIso,
  locale = 'en-GB',
}: Readonly<CalendarProps>) {
  const headingId = useId();
  const [focusedIso, setFocusedIso] = useState(() => selectedIso ?? toISODate(new Date()));
  const days = useMemo(() => monthGridDays(month), [month]);
  const labels = useMemo(() => weekdayLabels(locale), [locale]);
  const todayIso = toISODate(new Date());

  const moveFocus = (next: Date) => {
    setFocusedIso(toISODate(next));
    if (next.getMonth() !== month.getMonth() || next.getFullYear() !== month.getFullYear()) {
      onMonthChange(next);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(focusedIso);
      return;
    }
    const next = resolveMove(event.key, event.shiftKey, parseISODate(focusedIso) ?? new Date());
    if (next != null) {
      event.preventDefault();
      moveFocus(next);
    }
  };

  return (
    <div className="w-72 select-none" onKeyDown={handleKeyDown}>
      <div className="mb-2 flex items-center justify-between">
        <MonthButton label={FORM_COPY.previousMonth} onClick={() => onMonthChange(addMonths(month, -1))}>
          <IconChevronLeft size="sm" />
        </MonthButton>
        <h2 id={headingId} aria-live="polite" className="text-sm font-semibold text-[var(--icb-text)]">
          {monthLabel(month, locale)}
        </h2>
        <MonthButton label={FORM_COPY.nextMonth} onClick={() => onMonthChange(addMonths(month, 1))}>
          <IconChevronRight size="sm" />
        </MonthButton>
      </div>
      <div role="grid" aria-labelledby={headingId}>
        <div role="row" className="grid grid-cols-7">
          {labels.map((label) => (
            <span
              key={label.long}
              role="columnheader"
              aria-label={label.long}
              className="flex h-8 items-center justify-center text-xs font-medium text-[var(--icb-text-subtle)]"
            >
              {label.short}
            </span>
          ))}
        </div>
        {Array.from({ length: days.length / DAYS_IN_WEEK }, (_, week) => (
          <div role="row" key={week} className="grid grid-cols-7">
            {days.slice(week * DAYS_IN_WEEK, (week + 1) * DAYS_IN_WEEK).map((day) => {
              const iso = toISODate(day);
              const state = dayState(iso, selectedIso, rangeStartIso, rangeEndIso);
              return (
                <span role="gridcell" aria-selected={state.selected} key={iso}>
                  <button
                    type="button"
                    tabIndex={iso === focusedIso ? 0 : -1}
                    disabled={isIsoDisabled(iso, minIso, maxIso)}
                    aria-pressed={state.selected}
                    aria-label={iso}
                    onClick={() => onSelect(iso)}
                    onFocus={() => setFocusedIso(iso)}
                    className={dayClasses(day, month, todayIso, state)}
                  >
                    {day.getDate()}
                  </button>
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function MonthButton({
  label,
  onClick,
  children,
}: Readonly<{ label: string; onClick: () => void; children: ReactNode }>) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] text-[var(--icb-text-muted)] transition-colors hover:bg-[var(--icb-bg-muted)] hover:text-[var(--icb-text)] focus-visible:outline-none focus-visible:focus-ring"
    >
      {children}
    </button>
  );
}
