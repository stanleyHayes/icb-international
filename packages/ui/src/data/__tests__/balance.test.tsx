import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Balance } from '../balance';

const LEDGER = { minorUnits: 1205401, currency: 'USD', scale: 2 };
const AVAILABLE = { minorUnits: 1155401, currency: 'USD', scale: 2 };

describe('Balance', () => {
  it('shows only the ledger figure when available matches', () => {
    const html = renderToStaticMarkup(<Balance ledger={LEDGER} available={LEDGER} />);
    expect(html).toContain('12,054.01');
    expect(html).not.toContain('available to spend');
    expect(html).not.toContain('Why is this different?');
  });

  it('shows only the ledger figure when available is not provided', () => {
    const html = renderToStaticMarkup(<Balance ledger={LEDGER} />);
    expect(html).not.toContain('available to spend');
  });

  it('shows both figures with an explainer when they differ', () => {
    const html = renderToStaticMarkup(<Balance ledger={LEDGER} available={AVAILABLE} />);
    expect(html).toContain('12,054.01');
    expect(html).toContain('11,554.01');
    expect(html).toContain('available to spend');
    expect(html).toContain('Why is this different?');
    expect(html).toContain('holds and pending card authorisations');
  });
});
