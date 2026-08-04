import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Topbar } from '../topbar';

describe('Topbar', () => {
  it('renders the header landmark at the brand height with all slots', () => {
    const html = renderToStaticMarkup(
      <Topbar leading={<span>logo</span>} trailing={<span>avatar</span>}>
        <span>search</span>
      </Topbar>,
    );
    expect(html).toContain('<header');
    expect(html).toContain('height:var(--icb-header-height)');
    expect(html).toContain('logo');
    expect(html).toContain('search');
    expect(html).toContain('avatar');
  });

  it('sticks to the top by default and can opt out', () => {
    expect(renderToStaticMarkup(<Topbar />)).toContain('sticky');
    expect(renderToStaticMarkup(<Topbar sticky={false} />)).not.toContain('sticky');
  });
});
