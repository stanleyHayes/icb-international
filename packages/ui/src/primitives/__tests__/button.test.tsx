import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Button } from '../button';

describe('Button', () => {
  it('renders children with the primary variant by default', () => {
    const html = renderToStaticMarkup(<Button>Sign in</Button>);
    expect(html).toContain('Sign in');
    expect(html).toContain('bg-[var(--icb-primary)]');
    expect(html).toContain('h-10');
  });

  it('applies variant, size, and block classes', () => {
    const html = renderToStaticMarkup(
      <Button variant="danger" size="sm" block>
        Delete
      </Button>,
    );
    expect(html).toContain('bg-[var(--icb-danger)]');
    expect(html).toContain('h-8');
    expect(html).toContain('w-full');
  });

  it('announces and disables the loading state', () => {
    const html = renderToStaticMarkup(<Button loading>Saving</Button>);
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('disabled=""');
    expect(html).toContain('animate-spin');
  });

  it('honours the disabled prop', () => {
    expect(renderToStaticMarkup(<Button disabled>Save</Button>)).toContain('disabled=""');
  });

  it('merges a consumer className without losing the base styles', () => {
    const html = renderToStaticMarkup(<Button className="mt-4">Save</Button>);
    expect(html).toContain('mt-4');
    expect(html).toContain('bg-[var(--icb-primary)]');
  });
});
