import { describe, expect, it } from 'vitest';

import { BRANDING, NOW } from '../../__tests__/fixtures.js';
import {
  balanceConfirmationLetter,
  referenceLetter,
  renderLetterPdf,
  type LetterPdfInput,
} from '../letter-pdf.js';

function input(overrides: Partial<LetterPdfInput> = {}): LetterPdfInput {
  return {
    branding: BRANDING,
    title: "Banker's reference",
    addressedTo: 'The Letting Agent',
    reference: 'REF-2026-0042',
    paragraphs: ['A short letter that fits comfortably on a single page.'],
    details: [{ label: 'CUSTOMER', value: 'Ama Mensah' }],
    generatedAt: NOW,
    ...overrides,
  };
}

function latin1(buffer: Buffer): string {
  return buffer.toString('latin1');
}

describe('renderLetterPdf', () => {
  it('lays a short letter out on one page with its details and sign-off', () => {
    const pdf = renderLetterPdf(input());
    const text = latin1(pdf);

    expect(latin1(pdf.subarray(0, 8))).toBe('%PDF-1.4');
    expect(text).toContain('/Count 1');
    expect(text).toContain('To: The Letting Agent');
    expect(text).toContain('Yours faithfully,');
  });

  it('breaks onto a fresh page when the prose overruns the body', () => {
    const sentence = 'The bank confirms the arrangement described in this letter. ';
    const paragraphs = Array.from({ length: 30 }, () => sentence.repeat(6));

    const pdf = renderLetterPdf(input({ paragraphs }));
    const text = latin1(pdf);

    expect(text).toMatch(/\/Count [2-9]/);
    // The footer is drawn once, at the end, with the final page number.
    expect(text).toMatch(/Page [2-9]/);
  });
});

describe('balanceConfirmationLetter', () => {
  it('composes the confirmation prose and detail block from the account facts', () => {
    const letter = balanceConfirmationLetter({
      branding: BRANDING,
      holderName: 'Ama Mensah',
      addressedTo: 'The Letting Agent',
      reference: 'REF-2026-0043',
      productName: 'Everyday Current',
      identifiers: {
        number: '1234564321',
        iban: 'GH11ICBK12345678904321',
        bic: 'ICBKGHAC',
        sortCode: '12-34-56',
      },
      currency: 'GBP',
      balanceMinorUnits: 515_000,
      availableMinorUnits: 500_000,
      asOf: '2026-07-31',
      generatedAt: NOW,
    });

    const text = latin1(renderLetterPdf(letter));

    expect(letter.title).toBe('Balance confirmation');
    expect(text).toContain('Ama Mensah holds the account described below');
    expect(text).toContain('31 Jul 2026');
  });
});

describe('referenceLetter', () => {
  it('composes the banker reference from the relationship facts', () => {
    const letter = referenceLetter({
      branding: BRANDING,
      holderName: 'Ama Mensah',
      addressedTo: 'The Embassy',
      reference: 'REF-2026-0044',
      customerSince: '2024-01-15',
      accountCount: 2,
      generatedAt: NOW,
    });

    const text = latin1(renderLetterPdf(letter));

    expect(letter.title).toBe("Banker's reference");
    expect(text).toContain('has banked with International Commercial Bank since');
    expect(text).toContain('15 Jan 2024');
    expect(letter.details).toContainEqual({ label: 'OPEN ACCOUNTS', value: '2' });
  });
});
