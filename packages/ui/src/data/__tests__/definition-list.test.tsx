import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { DefinitionList } from '../definition-list';

const ITEMS = [
  { id: 'iban', term: 'IBAN', description: 'GH29 NIBA 0000 0000 1234 5678' },
  { id: 'opened', term: 'Opened', description: '12 Jan 2024' },
];

describe('DefinitionList', () => {
  it('renders a semantic description list', () => {
    const html = renderToStaticMarkup(<DefinitionList items={ITEMS} />);
    expect(html).toContain('<dl');
    expect(html).toContain('<dt');
    expect(html).toContain('IBAN');
    expect(html).toContain('GH29 NIBA 0000 0000 1234 5678');
  });

  it('divides rows in grid layout', () => {
    const html = renderToStaticMarkup(<DefinitionList items={ITEMS} layout="grid" />);
    expect(html).toContain('divide-y');
  });

  it('stacks in stacked layout', () => {
    const html = renderToStaticMarkup(<DefinitionList items={ITEMS} layout="stacked" />);
    expect(html).not.toContain('divide-y');
  });
});
