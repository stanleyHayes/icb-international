import type { FormState as BaseFormState } from '@/features/support/types';

/** A scheduled rate change as the API returns it after a write. */
export interface RateChangeView {
  effectiveFrom: string;
  rate: number;
}

export type FormState = BaseFormState;

export interface RateFormState extends FormState {
  /** The full schedule the API returned after the last save — shown until the next load. */
  schedule: RateChangeView[] | null;
}

export const IDLE: FormState = { status: 'idle', message: null, fieldErrors: {} };
export const IDLE_RATE: RateFormState = {
  status: 'idle',
  message: null,
  fieldErrors: {},
  schedule: null,
};
