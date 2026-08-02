import type { EmailBlock } from './email-block.js';
import type { TemplateContext } from './template.types.js';
import { formatInstant, safeUrl } from './theme.js';

/**
 * The plain-text alternative.
 *
 * Not an afterthought: it is what screen readers, text-only clients and spam filters read, and
 * it is what the in-app notification body is built from. Every fact present in the HTML is
 * present here, so no reader gets a degraded version of the message.
 */
export function renderTextLayout(block: EmailBlock, context: TemplateContext): string {
  const lines: string[] = [`Hello ${context.recipientName},`, '', block.heading, '', block.intro];

  if (block.figure !== undefined) {
    lines.push('', block.figure);
  }
  appendRows(lines, block);
  if (block.callout !== undefined) {
    lines.push('', block.callout.text);
  }
  appendAction(lines, block);
  if (block.outro !== undefined) {
    lines.push('', block.outro);
  }
  lines.push('', `Sent ${formatInstant(context.occurredAt)}.`);
  lines.push(
    `${context.bankName} will never ask you for your password, PIN or a one-time code.`,
  );

  return lines.join('\n');
}

function appendRows(lines: string[], block: EmailBlock): void {
  const items = block.rows ?? [];
  if (items.length === 0) {
    return;
  }
  lines.push('');
  for (const item of items) {
    lines.push(`${item.label}: ${item.value}`);
  }
}

function appendAction(lines: string[], block: EmailBlock): void {
  if (block.action === undefined) {
    return;
  }
  const href = safeUrl(block.action.url);
  if (href === null) {
    return;
  }
  lines.push('', `${block.action.label}: ${href}`);
}

/**
 * The one-line summary stored as an in-app notification body.
 *
 * The full plain text is right for an inbox and far too long for a notification bell, so the
 * in-app record carries the intro sentence plus the headline figure when there is one.
 */
export function summarise(block: EmailBlock): string {
  return block.figure === undefined ? block.intro : `${block.figure} · ${block.intro}`;
}
