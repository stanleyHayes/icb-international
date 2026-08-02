import type { AccountIdentifiers } from '@icb/contracts';
import type { CurrencyCode } from '@icb/money';

import { accountLabelFor, formatAmountWithCode, formatInstant } from './document-text.js';
import {
  BODY_BOTTOM,
  CONTENT_WIDTH,
  MARGIN,
  drawDetails,
  drawFooter,
  drawLetterhead,
  type DetailRow,
  type DocumentBranding,
} from './pdf-layout.js';
import { wrapText } from './pdf-metrics.js';
import { PdfWriter } from './pdf-writer.js';
import { formatIsoDate } from './statement-period.js';

export interface LetterPdfInput {
  branding: DocumentBranding;
  title: string;
  /** Who the letter is written to — a landlord, an embassy, or the holder themselves. */
  addressedTo: string;
  reference: string;
  paragraphs: readonly string[];
  details: readonly DetailRow[];
  generatedAt: Date;
}

const PROSE_SIZE = 10;
const LINE_HEIGHT = 15;
const PARAGRAPH_GAP = 8;
const SIGNATURE_GAP = 26;

/** Renders a one-page letter: salutation, prose, a detail block, and an authorised sign-off. */
export function renderLetterPdf(input: LetterPdfInput): Buffer {
  const pdf = new PdfWriter({
    title: input.title,
    author: input.branding.bankName,
    createdAt: input.generatedAt,
  });
  const issuedAt = formatInstant(input.generatedAt);

  let y = drawLetterhead(pdf, input.branding, input.title, `Reference ${input.reference}`);
  pdf.text(MARGIN, y, `To: ${input.addressedTo}`, { size: PROSE_SIZE, font: 'bold' });
  y += LINE_HEIGHT + PARAGRAPH_GAP;

  y = drawProse(pdf, input.paragraphs, y);
  y = drawDetails(pdf, MARGIN, y + PARAGRAPH_GAP, input.details) + PARAGRAPH_GAP;
  drawSignOff(pdf, input, y);
  drawFooter(pdf, input.branding, pdf.pageCount, issuedAt);

  return pdf.toBuffer();
}

function drawProse(pdf: PdfWriter, paragraphs: readonly string[], top: number): number {
  let y = top;
  for (const paragraph of paragraphs) {
    for (const line of wrapText(paragraph, 'regular', PROSE_SIZE, CONTENT_WIDTH)) {
      if (y > BODY_BOTTOM) {
        pdf.newPage();
        y = MARGIN + LINE_HEIGHT;
      }
      pdf.text(MARGIN, y, line, { size: PROSE_SIZE });
      y += LINE_HEIGHT;
    }
    y += PARAGRAPH_GAP;
  }
  return y;
}

function drawSignOff(pdf: PdfWriter, input: LetterPdfInput, top: number): void {
  pdf.text(MARGIN, top, 'Yours faithfully,', { size: PROSE_SIZE });
  pdf.text(MARGIN, top + SIGNATURE_GAP, `${input.branding.bankName} - Customer Operations`, {
    size: PROSE_SIZE,
    font: 'bold',
  });
  pdf.text(
    MARGIN,
    top + SIGNATURE_GAP + LINE_HEIGHT,
    'Issued electronically; valid without a manual signature.',
    { size: 8, grey: 0.42 },
  );
}

export interface BalanceLetterInput {
  branding: DocumentBranding;
  holderName: string;
  addressedTo: string;
  reference: string;
  productName: string;
  identifiers: AccountIdentifiers;
  currency: CurrencyCode;
  balanceMinorUnits: number;
  availableMinorUnits: number;
  asOf: string;
  generatedAt: Date;
}

/** Confirms a balance on a stated date — what a landlord or a visa office asks for. */
export function balanceConfirmationLetter(input: BalanceLetterInput): LetterPdfInput {
  const label = accountLabelFor(input.productName, input.identifiers.number);
  return {
    branding: input.branding,
    title: 'Balance confirmation',
    addressedTo: input.addressedTo,
    reference: input.reference,
    generatedAt: input.generatedAt,
    paragraphs: [
      `We confirm that ${input.holderName} holds the account described below with ` +
        `${input.branding.bankName}.`,
      `As at the close of business on ${formatIsoDate(input.asOf)}, the ledger balance of the ` +
        `account was ${formatAmountWithCode(input.balanceMinorUnits, input.currency)}, of which ` +
        `${formatAmountWithCode(input.availableMinorUnits, input.currency)} was available for ` +
        'withdrawal after allowing for holds.',
      'This confirmation reflects our records at the time of issue and does not constitute a ' +
        'guarantee of future balances or a commitment to lend.',
    ],
    details: [
      { label: 'ACCOUNT', value: label },
      { label: 'ACCOUNT NUMBER', value: input.identifiers.number },
      { label: 'IBAN', value: input.identifiers.iban },
      { label: 'BALANCE AS AT', value: formatIsoDate(input.asOf) },
    ],
  };
}

export interface ReferenceLetterInput {
  branding: DocumentBranding;
  holderName: string;
  addressedTo: string;
  reference: string;
  customerSince: string;
  accountCount: number;
  generatedAt: Date;
}

/** A banker's reference: how long the relationship has run, and how it has been conducted. */
export function referenceLetter(input: ReferenceLetterInput): LetterPdfInput {
  return {
    branding: input.branding,
    title: "Banker's reference",
    addressedTo: input.addressedTo,
    reference: input.reference,
    generatedAt: input.generatedAt,
    paragraphs: [
      `${input.holderName} has banked with ${input.branding.bankName} since ` +
        `${formatIsoDate(input.customerSince)} and currently holds ` +
        `${String(input.accountCount)} open account(s) with us.`,
      'The accounts have been conducted in accordance with our terms and the customer has ' +
        'satisfied our identity and address verification requirements.',
      'This reference is given in confidence, at the request of our customer, and without ' +
        'liability on the part of the bank or its officers.',
    ],
    details: [
      { label: 'CUSTOMER', value: input.holderName },
      { label: 'RELATIONSHIP SINCE', value: formatIsoDate(input.customerSince) },
      { label: 'OPEN ACCOUNTS', value: String(input.accountCount) },
    ],
  };
}
