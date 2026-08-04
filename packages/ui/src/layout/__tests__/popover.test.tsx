import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Popover } from '../popover';

describe('Popover', () => {
  it('renders a labelled trigger button with dialog wiring, closed by default', () => {
    const html = renderToStaticMarkup(
      <Popover trigger={<span>i</span>} triggerLabel="About available balance">
        <p>explainer</p>
      </Popover>,
    );
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-label="About available balance"');
    expect(html).not.toContain('explainer');
  });
});
