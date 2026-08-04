/**
 * Staff-side content views — the shapes the staff API (`/admin/content/*`) returns, imported
 * from the promoted contract (ADM-15) so the console and the API cannot drift.
 */
export type {
  ContentLocationView,
  FaqArticleView,
  RateEntryView,
  TemplateOverrideView,
  TemplatePreviewResult,
} from '@icb/contracts';

/** The tabs the content console switches between, in switcher order. */
export const CONTENT_TABS = [
  { id: 'faq', label: 'FAQ' },
  { id: 'locations', label: 'Locations' },
  { id: 'templates', label: 'Templates' },
  { id: 'rates', label: 'Rates' },
] as const;

export type ContentTab = (typeof CONTENT_TABS)[number]['id'];

/** Shared state shape for every content form action. */
export interface FormState {
  status: 'idle' | 'error' | 'done';
  message: string | null;
  fieldErrors: Record<string, string>;
}

export const IDLE_STATE: FormState = { status: 'idle', message: null, fieldErrors: {} };
