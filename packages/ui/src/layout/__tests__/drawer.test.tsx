import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Drawer } from '../drawer';

describe('Drawer', () => {
  it('renders nothing when closed', () => {
    expect(
      renderToStaticMarkup(
        <Drawer open={false} onClose={() => undefined}>
          body
        </Drawer>,
      ),
    ).toBe('');
  });

  it('renders a bottom-anchored modal with a drag handle when open', () => {
    const html = renderToStaticMarkup(
      <Drawer open onClose={() => undefined} title="Quick actions">
        body
      </Drawer>,
    );
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('bottom-0');
    expect(html).toContain('rounded-t-');
    expect(html).toContain('Quick actions');
    expect(html).toContain('aria-label="Close"');
  });

  it('renders content in a scrollable region', () => {
    const html = renderToStaticMarkup(
      <Drawer open onClose={() => undefined}>
        <p>tall content</p>
      </Drawer>,
    );
    expect(html).toContain('overflow-y-auto');
    expect(html).toContain('tall content');
  });
});
