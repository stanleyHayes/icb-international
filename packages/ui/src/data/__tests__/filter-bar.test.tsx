import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { FilterBar, type FilterDescriptor } from '../filter-bar';

const FILTERS: FilterDescriptor[] = [
  {
    id: 'status',
    label: 'Status',
    options: [
      { value: 'posted', label: 'Posted' },
      { value: 'pending', label: 'Pending' },
    ],
    value: null,
  },
];

describe('FilterBar', () => {
  it('renders one dropdown per filter with an "all" option', () => {
    const html = renderToStaticMarkup(
      <FilterBar filters={FILTERS} onFilterChange={() => undefined} />,
    );
    expect(html).toContain('Status: all');
    expect(html).toContain('Posted');
  });

  it('renders the search field only when both value and handler are given', () => {
    const withSearch = renderToStaticMarkup(
      <FilterBar filters={[]} onFilterChange={() => undefined} searchValue="" onSearchChange={() => undefined} />,
    );
    expect(withSearch).toContain('type="search"');
    const without = renderToStaticMarkup(<FilterBar filters={[]} onFilterChange={() => undefined} />);
    expect(without).not.toContain('type="search"');
  });

  it('shows a removable chip and clear-all for each active filter', () => {
    const active = [{ ...FILTERS[0], value: 'posted' } as FilterDescriptor];
    const html = renderToStaticMarkup(
      <FilterBar filters={active} onFilterChange={() => undefined} onClearAll={() => undefined} />,
    );
    expect(html).toContain('Status: Posted');
    expect(html).toContain('Clear all');
    expect(html).toContain('Remove filter Status');
  });

  it('hides the chips and clear-all when nothing is filtered', () => {
    const html = renderToStaticMarkup(
      <FilterBar filters={FILTERS} onFilterChange={() => undefined} onClearAll={() => undefined} />,
    );
    expect(html).not.toContain('Clear all');
  });
});
