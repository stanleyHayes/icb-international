import type { MoneyDto } from '@icb/contracts';

import { renderHtmlLayout } from './html-layout.js';
import { renderTextLayout, summarise } from './text-layout.js';
import type { RenderedTemplate, TemplateContext } from './template.types.js';
import { formatMoney } from './theme.js';

/**
 * The shape every ICB email takes.
 *
 * Templates describe *what* to say — a heading, a sentence, a table of facts, one action — and
 * never *how* it looks. That separation is why sixteen templates fit in a few hundred lines and
 * why a brand change is a single edit rather than sixteen.
 */

export type CalloutTone = 'gold' | 'navy' | 'danger' | 'success';

export interface EmailRow {
  readonly label: string;
  readonly value: string;
}

export interface EmailCallout {
  readonly tone: CalloutTone;
  readonly text: string;
}

export interface EmailAction {
  readonly label: string;
  readonly url: string;
}

export interface EmailBlock {
  /** Large headline inside the card. */
  readonly heading: string;
  /** The single sentence that carries the message if nothing else renders. */
  readonly intro: string;
  /** Optional hero figure — an amount, rendered large and in navy. */
  readonly figure?: string;
  readonly rows?: readonly EmailRow[];
  readonly callout?: EmailCallout;
  readonly action?: EmailAction;
  readonly outro?: string;
}

/** Compose the two representations a message needs: rich HTML and a plain-text equivalent. */
export function renderEmail(
  subject: string,
  block: EmailBlock,
  context: TemplateContext,
): RenderedTemplate {
  return {
    subject,
    html: renderHtmlLayout(subject, block, context),
    text: renderTextLayout(block, context),
    summary: summarise(block),
  };
}

/** Money for a row or a headline figure, or nothing when the caller supplied no amount. */
export function moneyText(amount: MoneyDto | undefined): string | undefined {
  return amount === undefined ? undefined : formatMoney(amount);
}

/**
 * The optional-slot helpers below exist because `exactOptionalPropertyTypes` is on: assigning
 * `figure: undefined` is a type error, so every optional slot has to be spread in or left out.
 * Doing that inline sixteen times would bury each template in ternaries.
 */
export function figureFor(value: string | undefined): Pick<EmailBlock, 'figure'> {
  return value === undefined ? {} : { figure: value };
}

export function actionFor(label: string, url: string | undefined): Pick<EmailBlock, 'action'> {
  return url === undefined || url === '' ? {} : { action: { label, url } };
}

export function calloutFor(
  tone: CalloutTone,
  text: string | undefined,
): Pick<EmailBlock, 'callout'> {
  return text === undefined || text === '' ? {} : { callout: { tone, text } };
}

/** Drops rows whose value never arrived, so an email never shows an empty field. */
export function rows(...candidates: readonly (EmailRow | null)[]): readonly EmailRow[] {
  return candidates.filter((row): row is EmailRow => row !== null);
}

/** A row, or nothing at all when the fact is absent. */
export function row(label: string, value: string | undefined): EmailRow | null {
  return value === undefined || value === '' ? null : { label, value };
}
