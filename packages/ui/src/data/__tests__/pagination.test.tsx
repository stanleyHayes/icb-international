import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Pagination, pageWindow } from '../pagination';

describe('pageWindow', () => {
  it('is empty when there are no pages', () => {
    expect(pageWindow(1, 0)).toEqual([]);
  });

  it('lists every page when they all fit', () => {
    expect(pageWindow(2, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it('ellipsises the middle on early pages', () => {
    expect(pageWindow(1, 20)).toEqual([1, 2, 'ellipsis-end', 20]);
  });

  it('ellipsises both sides around a middle page', () => {
    expect(pageWindow(10, 20)).toEqual([1, 'ellipsis-start', 9, 10, 11, 'ellipsis-end', 20]);
  });

  it('ellipsises the start on the last page', () => {
    expect(pageWindow(20, 20)).toEqual([1, 'ellipsis-start', 19, 20]);
  });

  it('keeps one page only when there is exactly one', () => {
    expect(pageWindow(1, 1)).toEqual([1]);
  });
});

describe('Pagination', () => {
  it('renders nothing for a single page', () => {
    expect(renderToStaticMarkup(<Pagination page={1} totalPages={1} onPageChange={() => undefined} />)).toBe('');
  });

  it('marks the current page and bounds the prev/next controls', () => {
    const html = renderToStaticMarkup(
      <Pagination page={1} totalPages={5} onPageChange={() => undefined} />,
    );
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('Previous page');
    expect(html).toContain('disabled=""');
  });

  it('labels the navigation landmark', () => {
    const html = renderToStaticMarkup(
      <Pagination page={3} totalPages={5} onPageChange={() => undefined} />,
    );
    expect(html).toContain('aria-label="Pagination"');
  });
});
