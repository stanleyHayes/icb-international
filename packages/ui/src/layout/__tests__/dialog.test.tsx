import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Dialog } from '../dialog';

describe('Dialog', () => {
  it('renders nothing when closed', () => {
    expect(
      renderToStaticMarkup(
        <Dialog open={false} onClose={() => undefined} title="Confirm" />,
      ),
    ).toBe('');
  });

  it('renders a labelled modal when open', () => {
    const html = renderToStaticMarkup(
      <Dialog
        open
        onClose={() => undefined}
        title="Freeze card"
        description="The card stops working immediately."
        footer={<button>Confirm</button>}
      >
        <p>body</p>
      </Dialog>,
    );
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-labelledby');
    expect(html).toContain('aria-describedby');
    expect(html).toContain('Freeze card');
    expect(html).toContain('The card stops working immediately.');
    expect(html).toContain('Confirm');
    expect(html).toContain('aria-label="Close"');
  });

  it('omits aria-describedby without a description', () => {
    const html = renderToStaticMarkup(
      <Dialog open onClose={() => undefined} title="Plain" />,
    );
    expect(html).not.toContain('aria-describedby');
  });

  it('applies size variants', () => {
    const html = renderToStaticMarkup(
      <Dialog open onClose={() => undefined} title="Wide" size="lg" />,
    );
    expect(html).toContain('max-w-2xl');
  });
});
