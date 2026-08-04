import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { SkeletonTable, SkeletonText, SkeletonTransactionList } from '../skeletons';

describe('Skeleton set', () => {
  it('SkeletonText renders the requested number of lines', () => {
    const html = renderToStaticMarkup(<SkeletonText lines={4} />);
    expect((html.match(/animate-pulse/g) ?? [])).toHaveLength(4);
  });

  it('SkeletonTable renders a header plus the requested rows', () => {
    const html = renderToStaticMarkup(<SkeletonTable rows={3} columns={2} />);
    expect(html).toContain('divide-y');
    expect(html.match(/animate-pulse/g) ?? []).toHaveLength(2 + 3 * 2);
  });

  it('SkeletonTransactionList renders a heading and rows', () => {
    const html = renderToStaticMarkup(<SkeletonTransactionList rows={2} />);
    expect(html.match(/animate-pulse/g) ?? []).toHaveLength(1 + 2 * 3);
  });

  it('is hidden from assistive technology', () => {
    const html = renderToStaticMarkup(<SkeletonTable rows={1} columns={1} />);
    expect(html).toContain('aria-hidden="true"');
  });
});
