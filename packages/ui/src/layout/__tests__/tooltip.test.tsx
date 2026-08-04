import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Tooltip } from '../tooltip';

describe('Tooltip', () => {
  it('renders the trigger without a tip by default', () => {
    const html = renderToStaticMarkup(
      <Tooltip content="Sort ascending">
        <button type="button">Sort</button>
      </Tooltip>,
    );
    expect(html).toContain('Sort');
    expect(html).not.toContain('role="tooltip"');
    expect(html).not.toContain('aria-describedby');
  });
});
