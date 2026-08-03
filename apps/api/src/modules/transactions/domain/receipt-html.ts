import type { TransactionDetail } from '@icb/contracts';
import { format, type CurrencyCode } from '@icb/money';

/**
 * Receipt renderer. Produces a self-contained HTML document — no external assets, no scripts —
 * so it prints cleanly and renders identically everywhere. Every interpolated value passes
 * through `escapeHtml`: a note or narrative must never become markup.
 */

export interface ReceiptContext {
  readonly bankName: string;
  readonly detail: TransactionDetail;
  readonly generatedAt: Date;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function money(minorUnits: number, currency: string): string {
  return format({ minorUnits, currency: currency as CurrencyCode });
}

function row(label: string, value: string | null): string {
  if (value === null || value.length === 0) {
    return '';
  }
  return `<tr><th scope="row">${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`;
}

const STYLES = [
  'body{font-family:-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;margin:0;background:#f5f6f8;color:#1a1d21}',
  'main{max-width:480px;margin:32px auto;background:#fff;border:1px solid #e3e6ea;border-radius:12px;padding:32px}',
  'header{text-align:center;border-bottom:1px solid #e3e6ea;padding-bottom:16px;margin-bottom:16px}',
  'h1{font-size:18px;margin:0 0 4px}h2{font-size:13px;font-weight:500;color:#6b7280;margin:0}',
  '.amount{font-size:32px;font-weight:700;text-align:center;margin:24px 0 4px}',
  '.description{text-align:center;color:#6b7280;margin:0 0 24px}',
  'table{width:100%;border-collapse:collapse;font-size:14px}',
  'th{text-align:left;color:#6b7280;font-weight:500;padding:8px 0;vertical-align:top}',
  'td{text-align:right;padding:8px 0}',
  'footer{text-align:center;color:#9ca3af;font-size:12px;margin-top:24px}',
].join('\n');

function statusLabel(detail: TransactionDetail): string {
  if (detail.pending) {
    return 'Pending';
  }
  return detail.status === 'reversed' ? 'Reversed' : 'Completed';
}

/** The receipt for one transaction, as a complete HTML document. */
export function renderReceiptHtml(context: ReceiptContext): string {
  const { detail } = context;
  const signed = detail.direction === 'credit' ? detail.amount.minorUnits : -detail.amount.minorUnits;

  const rows = [
    row('Status', statusLabel(detail)),
    row('Date', detail.bookedAt),
    row('Value date', detail.valueDate),
    row('Reference', detail.reference),
    row('Merchant', detail.merchant?.name ?? null),
    row('Category', detail.category),
    row('Account', detail.accountId),
    row('Note', detail.note),
  ].join('');

  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    `<title>Receipt ${escapeHtml(detail.reference)}</title>`,
    `<style>${STYLES}</style>`,
    '</head>',
    '<body>',
    '<main>',
    `<header><h1>${escapeHtml(context.bankName)}</h1><h2>Transaction receipt</h2></header>`,
    `<p class="amount">${escapeHtml(money(signed, detail.amount.currency))}</p>`,
    `<p class="description">${escapeHtml(detail.description)}</p>`,
    `<table>${rows}</table>`,
    `<footer>Generated ${escapeHtml(context.generatedAt.toISOString())} · ${escapeHtml(context.bankName)}</footer>`,
    '</main>',
    '</body>',
    '</html>',
  ].join('\n');
}
