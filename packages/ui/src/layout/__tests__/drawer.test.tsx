import '@testing-library/jest-dom/vitest';
// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Drawer } from '../drawer';

afterEach(cleanup);

describe('Drawer', () => {
  it('renders nothing when closed', () => {
    render(
      <Drawer open={false} onClose={() => undefined}>
        body
      </Drawer>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders a bottom-anchored modal with a drag handle when open', () => {
    render(
      <Drawer open onClose={() => undefined} title="Quick actions">
        body
      </Drawer>,
    );
    const html = document.body.innerHTML;
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('bottom-0');
    expect(html).toContain('rounded-t-');
    expect(html).toContain('Quick actions');
    expect(html).toContain('aria-label="Close"');
  });

  it('renders content in a scrollable region', () => {
    render(
      <Drawer open onClose={() => undefined}>
        <p>tall content</p>
      </Drawer>,
    );
    const html = document.body.innerHTML;
    expect(html).toContain('overflow-y-auto');
    expect(html).toContain('tall content');
  });
});
