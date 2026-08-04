'use client';

import { createContext, useContext, useId } from 'react';

/** The a11y wiring a {@link Field} hands down to the control it wraps. */
export interface FieldState {
  readonly id: string;
  readonly labelId: string;
  readonly describedBy: string | undefined;
  readonly invalid: boolean;
  readonly required: boolean;
  readonly disabled: boolean;
}

export const FieldContext = createContext<FieldState | null>(null);

export function useFieldState(): FieldState | null {
  return useContext(FieldContext);
}

export interface FieldA11yOverrides {
  readonly id?: string | undefined;
  readonly describedBy?: string | undefined;
  readonly invalid?: boolean | undefined;
  readonly required?: boolean | undefined;
  readonly disabled?: boolean | undefined;
}

/** The resolved id + aria attributes every control spreads onto its focusable element. */
export interface FieldA11y {
  readonly id: string;
  readonly describedBy: string | undefined;
  readonly invalid: true | undefined;
  readonly required: boolean | undefined;
  readonly disabled: boolean | undefined;
}

function joinIds(...ids: ReadonlyArray<string | undefined>): string | undefined {
  const joined = ids.filter((id) => id != null && id !== '').join(' ');
  return joined === '' ? undefined : joined;
}

function firstDefined<T>(values: ReadonlyArray<T | undefined>): T | undefined {
  return values.find((value) => value !== undefined);
}

/**
 * Resolve a control's id and aria wiring. Explicit props win, then an enclosing {@link Field},
 * then a generated id — so a control used standalone is still labellable, and one inside a
 * Field automatically picks up `aria-describedby` error/description association.
 */
export function useFieldA11y(overrides: FieldA11yOverrides = {}): FieldA11y {
  const field = useContext(FieldContext);
  const generatedId = useId();
  const invalid = firstDefined([overrides.invalid, field?.invalid, false]);
  return {
    id: firstDefined([overrides.id, field?.id, generatedId]) ?? generatedId,
    describedBy: joinIds(overrides.describedBy, field?.describedBy),
    invalid: invalid === true || undefined,
    required: firstDefined([overrides.required, field?.required]),
    disabled: firstDefined([overrides.disabled, field?.disabled]),
  };
}
