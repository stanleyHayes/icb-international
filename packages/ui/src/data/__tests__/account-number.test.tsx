import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { AccountNumber } from '../account-number';

const IBAN = 'GH29NIBA0000000012345678';

describe('AccountNumber', () => {
  it('is masked by default and never leaks the full value', () => {
    const html = renderToStaticMarkup(<AccountNumber value={IBAN} />);
    expect(html).toContain('••••');
    expect(html).toContain('5678');
    expect(html).not.toContain('GH29NIBA0000000012345678');
  });

  it('offers a reveal toggle with announced state', () => {
    const html = renderToStaticMarkup(<AccountNumber value={IBAN} />);
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('Reveal account number');
  });

  it('hides the toggle when the number must stay masked', () => {
    const html = renderToStaticMarkup(<AccountNumber value={IBAN} revealable={false} />);
    expect(html).not.toContain('button');
    expect(html).toContain('••••');
  });
});
