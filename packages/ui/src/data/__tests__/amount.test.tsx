import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Amount } from '../amount';

const USD = { minorUnits: 123400, currency: 'USD', scale: 2 };

describe('Amount', () => {
  it('formats through @icb/money with full scale', () => {
    const html = renderToStaticMarkup(<Amount value={USD} />);
    expect(html).toContain('1,234.00');
  });

  it('renders a debit negative with the debit colour', () => {
    const html = renderToStaticMarkup(<Amount value={USD} direction="debit" />);
    expect(html).toContain('--icb-debit');
    expect(html).toMatch(/[−-].{0,20}1,234\.00/);
  });

  it('renders a credit with an explicit plus sign', () => {
    const html = renderToStaticMarkup(<Amount value={USD} direction="credit" />);
    expect(html).toContain('--icb-credit');
    expect(html).toContain('+');
  });

  it('keeps a negative ledger figure negative without a direction', () => {
    const html = renderToStaticMarkup(<Amount value={{ ...USD, minorUnits: -500 }} />);
    expect(html).toMatch(/[−-].{0,20}5\.00/);
    expect(html).not.toContain('--icb-debit');
  });

  it('shows the currency code when asked', () => {
    const html = renderToStaticMarkup(<Amount value={USD} showCurrency />);
    expect(html).toContain('USD');
  });

  it('respects a zero-decimal currency', () => {
    const html = renderToStaticMarkup(
      <Amount value={{ minorUnits: 1500, currency: 'JPY', scale: 0 }} />,
    );
    expect(html).toContain('1,500');
    expect(html).not.toContain('1,500.');
  });
});
