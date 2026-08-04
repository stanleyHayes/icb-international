'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

import { cn } from '../lib/cn';
import { Calendar, CalendarGlyph } from './calendar';
import { isIsoDisabled, parseFlexibleDate, parseISODate, toISODate } from './date-utils';
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

export interface DatePickerProps {
  /** ISO `YYYY-MM-DD`, or `null` when no date is chosen. */
  readonly value: string | null;
  readonly onChange: (iso: string | null) => void;
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

const DEFAULT_PLACEHOLDER = 'YYYY-MM-DD';

/**
 * A single-date field: a free-typed input (ISO or `dd/mm/yyyy`, committed on blur/Enter) plus
 * a keyboard-complete calendar popover. The form value is always an ISO string or `null`,
 * never a `Date` — what the API expects is what the form holds.
 */
export function DatePicker({
  value,
  onChange,
  onBlur,
  name,
  minIso,
  maxIso,
  locale,
  placeholder = DEFAULT_PLACEHOLDER,
  size = 'md',
  invalid,
  disabled,
  required,
  id,
  className,
}: Readonly<DatePickerProps>) {
  const a11y = useFieldA11y({ id, invalid, disabled, required });
  const popover = usePopover();
  const [month, setMonth] = useState(() => parseISODate(value ?? '') ?? new Date());
  const [draft, setDraft] = useState(value ?? '');

  // Resync only when the value actually changes — never mid-typing.
  const previousValue = useRef(value);
  useEffect(() => {
    if (previousValue.current !== value) {
      previousValue.current = value;
      setDraft(value ?? '');
    }
  }, [value]);

  const commitDraft = () => {
    const outcome = settleDraft(draft, minIso, maxIso);
    if (outcome.kind === 'invalid') {
      setDraft(value ?? '');
      return;
    }
    const iso = outcome.kind === 'valid' ? outcome.iso : null;
    setDraft(iso ?? '');
    onChange(iso);
  };

  const handleSelect = (iso: string) => {
    onChange(iso);
    setDraft(iso);
    setMonth(parseISODate(iso) ?? month);
    popover.closePopover();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commitDraft();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      popover.openPopover();
    }
  };

  return (
    <div ref={popover.containerRef} className={cn('relative', className)}>
      <input
        type="text"
        inputMode="numeric"
        id={a11y.id}
        value={draft}
        placeholder={placeholder}
        disabled={a11y.disabled}
        required={a11y.required}
        aria-invalid={a11y.invalid}
        aria-describedby={a11y.describedBy}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          commitDraft();
          onBlur?.();
        }}
        className={cn(
          CONTROL_BASE_CLASSES,
          CONTROL_SIZES[size],
          'tabular pr-10',
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
            selectedIso={value}
            minIso={minIso}
            maxIso={maxIso}
            locale={locale}
          />
        </div>
      ) : null}
      {name != null ? <input type="hidden" name={name} value={value ?? ''} /> : null}
    </div>
  );
}

function draftToIso(draft: string): string | null {
  const parsed = parseFlexibleDate(draft);
  return parsed == null ? null : toISODate(parsed);
}

type DraftOutcome =
  | { readonly kind: 'empty' }
  | { readonly kind: 'invalid' }
  | { readonly kind: 'valid'; readonly iso: string };

function settleDraft(draft: string, minIso?: string, maxIso?: string): DraftOutcome {
  if (draft.trim() === '') {
    return { kind: 'empty' };
  }
  const iso = draftToIso(draft);
  if (iso == null || isIsoDisabled(iso, minIso, maxIso)) {
    return { kind: 'invalid' };
  }
  return { kind: 'valid', iso };
}
