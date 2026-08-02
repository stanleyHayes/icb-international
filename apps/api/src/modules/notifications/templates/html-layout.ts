import type { CalloutTone, EmailAction, EmailBlock, EmailCallout, EmailRow } from './email-block.js';
import type { TemplateContext } from './template.types.js';
import { BRAND, FONT_STACK, escapeHtml, formatInstant, safeUrl } from './theme.js';

/**
 * The HTML shell.
 *
 * Tables and inline styles, because Outlook still renders with Word and every real bank email
 * has to survive it. No external stylesheet, no web font request, no remote image: an email
 * client that blocks everything still shows a correctly branded, fully readable message.
 */

const TEXT = `font-family:${FONT_STACK};`;
const CARD_PAD = 'padding:28px 32px;';
const MUTED_SMALL = `${TEXT}font-size:13px;line-height:20px;color:${BRAND.muted};margin:0;`;
const LABEL_CELL = `${TEXT}font-size:13px;color:${BRAND.muted};padding:9px 12px 9px 0;vertical-align:top;`;
const VALUE_CELL = `${TEXT}font-size:14px;font-weight:600;color:${BRAND.ink};padding:9px 0;text-align:right;vertical-align:top;`;

const TONES: Readonly<Record<CalloutTone, string>> = {
  gold: BRAND.gold,
  navy: BRAND.navy,
  danger: BRAND.danger,
  success: BRAND.success,
};

export function renderHtmlLayout(
  subject: string,
  block: EmailBlock,
  context: TemplateContext,
): string {
  return [
    head(subject),
    `<body style="margin:0;padding:0;background:${BRAND.canvas};">`,
    preheader(block.intro),
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${BRAND.canvas};padding:32px 12px;"><tr><td align="center">`,
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;background:${BRAND.surface};border:1px solid ${BRAND.line};border-radius:14px;overflow:hidden;">`,
    masthead(context.bankName),
    content(block, context),
    footer(context),
    '</table></td></tr></table></body></html>',
  ].join('');
}

function head(subject: string): string {
  return (
    '<!doctype html><html lang="en"><head><meta charset="utf-8" />' +
    '<meta name="viewport" content="width=device-width,initial-scale=1" />' +
    '<meta name="color-scheme" content="light only" />' +
    `<title>${escapeHtml(subject)}</title></head>`
  );
}

/** The grey line an inbox shows next to the subject. Hidden in the message itself. */
function preheader(intro: string): string {
  return `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(intro)}</div>`;
}

function masthead(bankName: string): string {
  const wordmark = `<span style="${TEXT}font-size:23px;font-weight:800;letter-spacing:0.06em;color:${BRAND.onDark};">ICB</span>`;
  const name = `<span style="${TEXT}font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:${BRAND.gold};padding-left:12px;">${escapeHtml(bankName)}</span>`;
  return (
    `<tr><td style="background:${BRAND.navy};padding:22px 32px;">${wordmark}${name}</td></tr>` +
    `<tr><td style="height:3px;line-height:3px;font-size:0;background:${BRAND.gold};">&nbsp;</td></tr>`
  );
}

function content(block: EmailBlock, context: TemplateContext): string {
  const heading = `<h1 style="${TEXT}margin:0 0 10px;font-size:22px;line-height:30px;font-weight:700;color:${BRAND.navy};">${escapeHtml(block.heading)}</h1>`;
  const greeting = `<p style="${TEXT}margin:0 0 6px;font-size:14px;color:${BRAND.muted};">Hello ${escapeHtml(context.recipientName)},</p>`;
  const intro = `<p style="${TEXT}margin:0 0 18px;font-size:15px;line-height:24px;color:${BRAND.ink};">${escapeHtml(block.intro)}</p>`;
  return (
    `<tr><td style="${CARD_PAD}">${greeting}${heading}${intro}` +
    figure(block.figure) +
    rowsTable(block.rows ?? []) +
    callout(block.callout) +
    action(block.action) +
    outro(block.outro) +
    '</td></tr>'
  );
}

function figure(value: string | undefined): string {
  if (value === undefined) {
    return '';
  }
  return `<p style="${TEXT}margin:0 0 18px;font-size:32px;line-height:38px;font-weight:700;letter-spacing:-0.01em;color:${BRAND.navy};">${escapeHtml(value)}</p>`;
}

function rowsTable(items: readonly EmailRow[]): string {
  if (items.length === 0) {
    return '';
  }
  const cells = items.map(rowCell).join('');
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-top:1px solid ${BRAND.line};border-bottom:1px solid ${BRAND.line};margin:0 0 20px;">${cells}</table>`;
}

function rowCell(item: EmailRow): string {
  const label = `<td style="${LABEL_CELL}">${escapeHtml(item.label)}</td>`;
  const value = `<td style="${VALUE_CELL}">${escapeHtml(item.value)}</td>`;
  return `<tr>${label}${value}</tr>`;
}

function callout(value: EmailCallout | undefined): string {
  if (value === undefined) {
    return '';
  }
  const accent = TONES[value.tone];
  return `<p style="${TEXT}margin:0 0 20px;padding:12px 16px;border-left:3px solid ${accent};background:${BRAND.canvas};border-radius:0 8px 8px 0;font-size:14px;line-height:22px;color:${BRAND.ink};">${escapeHtml(value.text)}</p>`;
}

function action(value: EmailAction | undefined): string {
  const href = value === undefined ? null : safeUrl(value.url);
  if (value === undefined || href === null) {
    return '';
  }
  const anchor = `<a href="${escapeHtml(href)}" style="${TEXT}display:inline-block;padding:12px 26px;font-size:15px;font-weight:600;color:${BRAND.onDark};text-decoration:none;">${escapeHtml(value.label)}</a>`;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;"><tr><td style="background:${BRAND.primary};border-radius:9px;">${anchor}</td></tr></table>`;
}

function outro(value: string | undefined): string {
  if (value === undefined) {
    return '';
  }
  return `<p style="${MUTED_SMALL}">${escapeHtml(value)}</p>`;
}

function footer(context: TemplateContext): string {
  const stamp = `<p style="${MUTED_SMALL}margin-bottom:6px;">Sent ${escapeHtml(formatInstant(context.occurredAt))}.</p>`;
  const legal = `<p style="${MUTED_SMALL}">${escapeHtml(context.bankName)} will never ask you for your password, PIN or a one-time code. You are receiving this because of your notification preferences.</p>`;
  return `<tr><td style="padding:20px 32px 28px;background:${BRAND.canvas};border-top:1px solid ${BRAND.line};">${stamp}${legal}</td></tr>`;
}
