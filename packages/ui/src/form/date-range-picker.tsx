'use client';

import { useState } from 'react';

import { cn } from '../lib/cn';
import { formatDate } from '../lib/format';
import { Calendar, CalendarGlyph } from './calendar';
import { compareISODates, parseISODate } from './date-utils';
import {
  CONTROL_BASE_CLASSES,
  CONTROL_INVALID_CLASSES,
  CONTROL_SIZES,
  FORM_COPY,
  POPOVER_PANEL_CLASSES,
  type ControlSize,
} from './form.constants';
import { useFieldA11y } from './use-field';
import { usePopover } from './use-popover';

export interface DateRange {
  readonly start: string | null;
  readonly end: string | null;
}

export interface DateRangePickerProps {
  readonly value: DateRange;
  readonly onChange: (range: DateRange) => void;
  readonly onBlur?: () => void;
  readonly name?: string;
  readonly minIso?: string;
  readonly maxIso?: string;
  readonly locale?: string;
  readonly placeholder?: string;
  readonly size?: ControlSize;
  readonly invalid?: boolean;
  readonly disabled?: boolean;
  readonly required?: boolean;
  readonly id?: string;
  readonly className?: string;
}

const DEFAULT_PLACEHOLDER = 'Select dates';
const RANGE_SEPARATOR = ' – ';

function rangeLabel(value: DateRange, locale: string): string {
  if (value.start == null) {
    return '';
  }
  const start = formatDate(value.start, 'medium', locale);
  return value.end == null
    ? `${start}${RANGE_SEPARATOR}`
    : `${start}${RANGE_SEPARATOR}${formatDate(value.end, 'medium', locale)}`;
}

/**
 * A two-click range picker: the first click sets the start, the second the end (reversed
 * clicks swap). The input is read-only — ranges typed by hand are an error farm — and the
 * calendar carries the full keyboard contract.
 */
export function DateRangePicker({
  value,
  onChange,
  onBlur,
  name,
  minIso,
  maxIso,
  locale = 'en-GB',
  placeholder = DEFAULT_PLACEHOLDER,
  size = 'md',
  invalid,
  disabled,
  required,
  id,
  className,
}: Readonly<DateRangePickerProps>) {
  const a11y = useFieldA11y({ id, invalid, disabled, required });
  const popover = usePopover();
  const [month, setMonth] = useState(() => parseISODate(value.start ?? '') ?? new Date());

  const handleSelect = (iso: string) => {
    if (value.start == null || value.end != null) {
      onChange({ start: iso, end: null });
    } else if (compareISODates(iso, value.start) < 0) {
      onChange({ start: iso, end: value.start });
    } else {
      onChange({ start: value.start, end: iso });
      popover.closePopover();
    }
  };

  return (
    <div ref={popover.containerRef} className={cn('relative', className)}>
      <input
        type="text"
        readOnly
        id={a11y.id}
        value={rangeLabel(value, locale)}
        placeholder={placeholder}
        disabled={a11y.disabled}
        required={a11y.required}
        aria-invalid={a11y.invalid}
        aria-describedby={a11y.describedBy}
        onClick={popover.togglePopover}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'Enter') {
            event.preventDefault();
            popover.openPopover();
          }
        }}
        onBlur={onBlur}
        className={cn(
          CONTROL_BASE_CLASSES,
          CONTROL_SIZES[size],
          'cursor-pointer pr-10',
          a11y.invalid === true && CONTROL_INVALID_CLASSES,
        )}
      />
      <button
        type="button"
        aria-label={FORM_COPY.calendarOpen}
        disabled={a11y.disabled}
        onClick={popover.togglePopover}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-[var(--icb-text-subtle)] transition-colors hover:text-[var(--icb-text)] disabled:opacity-50"
      >
        <CalendarGlyph />
      </button>
      {popover.open ? (
        <div className={cn(POPOVER_PANEL_CLASSES, 'p-3')}>
          <Calendar
            month={month}
            onMonthChange={setMonth}
            onSelect={handleSelect}
            rangeStartIso={value.start}
            rangeEndIso={value.end}
            minIso={minIso}
            maxIso={maxIso}
            locale={locale}
          />
        </div>
      ) : null}
      {name != null ? (
        <>
          <input type="hidden" name={`${name}[start]`} value={value.start ?? ''} />
          <input type="hidden" name={`${name}[end]`} value={value.end ?? ''} />
        </>
      ) : null}
    </div>
  );
}
