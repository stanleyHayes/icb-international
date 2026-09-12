import '@testing-library/jest-dom/vitest';
// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Drawer } from '../drawer';

afterEach(cleanup);

describe('OverlayFrame portalling', () => {
  it('escapes an ancestor that would otherwise contain it', () => {
    // Both app headers carry `backdrop-blur`, which makes the header the containing block for
    // any `position: fixed` descendant. Rendered in place, the page-help drawer was sized to
    // the 64px header and painted inside it; `position: relative` on the same header then
    // scoped its z-index there too. Mounting on `document.body` is what prevents both.
    render(
      <header style={{ backdropFilter: 'blur(8px)', position: 'relative' }}>
        <Drawer open onClose={() => undefined} title="How to use Accounts">
          body
        </Drawer>
      </header>,
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog.closest('header')).toBeNull();
  });

  it('mounts the overlay as a direct child of document.body', () => {
    render(
      <Drawer open onClose={() => undefined} title="Quick actions">
        body
      </Drawer>,
    );

    const overlay = screen.getByRole('dialog').parentElement;
    expect(overlay?.parentElement).toBe(document.body);
  });

  it('takes the whole viewport rather than its parent box', () => {
    render(
      <Drawer open onClose={() => undefined} title="Quick actions">
        body
      </Drawer>,
    );

    // `fixed inset-0` only means the viewport once the overlay is out of a containing ancestor.
    const overlay = screen.getByRole('dialog').parentElement;
    expect(overlay?.className).toContain('fixed');
    expect(overlay?.className).toContain('inset-0');
  });
});
