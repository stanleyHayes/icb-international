import '@testing-library/jest-dom/vitest';
// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Sheet } from '../sheet';

afterEach(cleanup);

describe('Sheet', () => {
  it('renders nothing when closed', () => {
    render(
      <Sheet open={false} onClose={() => undefined}>
        body
      </Sheet>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders a right-anchored modal panel by default', () => {
    render(
      <Sheet open onClose={() => undefined} title="Filters">
        body
      </Sheet>,
    );
    const html = document.body.innerHTML;
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('right-0');
    expect(html).toContain('Filters');
    expect(html).toContain('aria-label="Close"');
  });

  it('anchors to other edges', () => {
    render(
      <Sheet open onClose={() => undefined} side="left">
        body
      </Sheet>,
    );
    expect(document.body.innerHTML).toContain('left-0');
  });

  it('works without a title', () => {
    render(
      <Sheet open onClose={() => undefined}>
        body
      </Sheet>,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });
});
