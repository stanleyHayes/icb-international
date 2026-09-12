import '@testing-library/jest-dom/vitest';
// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Dialog } from '../dialog';

afterEach(cleanup);

describe('Dialog', () => {
  it('renders nothing when closed', () => {
    render(<Dialog open={false} onClose={() => undefined} title="Confirm" />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders a labelled modal when open', () => {
    render(
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
    const html = document.body.innerHTML;
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
    render(<Dialog open onClose={() => undefined} title="Plain" />);
    expect(screen.getByRole('dialog')).not.toHaveAttribute('aria-describedby');
  });

  it('applies size variants', () => {
    render(<Dialog open onClose={() => undefined} title="Wide" size="lg" />);
    expect(document.body.innerHTML).toContain('max-w-2xl');
  });
});
