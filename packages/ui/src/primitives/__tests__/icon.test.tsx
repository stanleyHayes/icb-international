import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Icon, ICON_GRID, ICON_SIZES, ICON_STROKE_WIDTH } from '../icon';
import * as glyphs from '../icons';

describe('Icon', () => {
  it('renders on the 24 grid at md size with the shared stroke', () => {
    const html = renderToStaticMarkup(
      <Icon>
        <path d="M0 0h1" />
      </Icon>,
    );
    expect(html).toContain(`viewBox="0 0 ${ICON_GRID} ${ICON_GRID}"`);
    expect(html).toContain(`width="${ICON_SIZES.md}"`);
    expect(html).toContain(`height="${ICON_SIZES.md}"`);
    expect(html).toContain(`stroke-width="${ICON_STROKE_WIDTH}"`);
    expect(html).toContain('stroke="currentColor"');
  });

  it('is hidden from assistive technology without a label', () => {
    const html = renderToStaticMarkup(
      <Icon>
        <path d="M0 0h1" />
      </Icon>,
    );
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain('role="img"');
  });

  it('becomes an announced image when labelled', () => {
    const html = renderToStaticMarkup(
      <Icon label="Lock">
        <path d="M0 0h1" />
      </Icon>,
    );
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Lock"');
  });

  it('accepts named and numeric sizes', () => {
    expect(renderToStaticMarkup(<Icon size="lg">x</Icon>)).toContain(`width="${ICON_SIZES.lg}"`);
    expect(renderToStaticMarkup(<Icon size={18}>x</Icon>)).toContain('width="18"');
  });
});

describe('glyph set', () => {
  const entries = Object.entries(glyphs);

  it('ships the full core set a bank UI needs', () => {
    expect(entries).toHaveLength(24);
  });

  it.each(entries)('%s renders an svg on the shared grid', (_name, Glyph) => {
    const html = renderToStaticMarkup(<Glyph />);
    expect(html).toMatch(/^<svg/);
    expect(html).toContain(`viewBox="0 0 ${ICON_GRID} ${ICON_GRID}"`);
    expect(html).toContain('aria-hidden="true"');
  });

  it('passes wrapper props through glyphs', () => {
    const html = renderToStaticMarkup(<glyphs.IconSearch size="sm" label="Search" />);
    expect(html).toContain(`width="${ICON_SIZES.sm}"`);
    expect(html).toContain('aria-label="Search"');
  });
});
