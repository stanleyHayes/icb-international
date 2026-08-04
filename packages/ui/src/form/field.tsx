'use client';

import { useId, useMemo, type ReactNode } from 'react';

import { cn } from '../lib/cn';
import {
  FIELD_DESCRIPTION_CLASSES,
  FIELD_ERROR_CLASSES,
  FIELD_ID_PARTS,
  FIELD_LABEL_CLASSES,
} from './form.constants';
import { FieldContext, type FieldState } from './use-field';

export interface FieldProps {
  readonly id?: string;
  readonly label?: ReactNode;
  readonly description?: ReactNode;
  /** When set, the field is invalid and the message is announced via `role="alert"`. */
  readonly error?: ReactNode;
  readonly required?: boolean;
  readonly disabled?: boolean;
  readonly className?: string;
  readonly children: ReactNode;
}

function joinDescribedBy(...ids: ReadonlyArray<string | undefined>): string | undefined {
  const joined = ids.filter((id) => id != null).join(' ');
  return joined === '' ? undefined : joined;
}

/**
 * The label / description / error wrapper every form control composes with.
 *
 * The control rendered as `children` reads this context through `useFieldA11y`, so the
 * `aria-describedby` association between control, description, and error is wired once here
 * rather than re-derived in sixteen components.
 */
export function Field({
  id: idProp,
  label,
  description,
  error,
  required = false,
  disabled = false,
  className,
  children,
}: Readonly<FieldProps>) {
  const generatedId = useId();
  const id = idProp ?? generatedId;

  const state = useMemo<FieldState>(() => {
    const descriptionId = description != null ? `${id}-${FIELD_ID_PARTS.description}` : undefined;
    const errorId = error != null ? `${id}-${FIELD_ID_PARTS.error}` : undefined;
    return {
      id,
      labelId: `${id}-${FIELD_ID_PARTS.label}`,
      describedBy: joinDescribedBy(descriptionId, errorId),
      invalid: error != null,
      required,
      disabled,
    };
  }, [id, description, error, required, disabled]);

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label != null ? (
        <label htmlFor={id} id={state.labelId} className={FIELD_LABEL_CLASSES}>
          {label}
          {required ? (
            <>
              <span aria-hidden="true" className="text-[var(--icb-danger)]">
                {' *'}
              </span>
              <span className="sr-only"> (required)</span>
            </>
          ) : null}
        </label>
      ) : null}
      <FieldContext.Provider value={state}>{children}</FieldContext.Provider>
      {description != null ? (
        <p id={`${id}-${FIELD_ID_PARTS.description}`} className={FIELD_DESCRIPTION_CLASSES}>
          {description}
        </p>
      ) : null}
      {error != null ? (
        <p id={`${id}-${FIELD_ID_PARTS.error}`} role="alert" className={FIELD_ERROR_CLASSES}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
