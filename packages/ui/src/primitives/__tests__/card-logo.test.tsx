import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Card, CardBody, CardFooter, CardHeader } from '../card';
import { IcbLogo, IcbMark } from '../logo';

describe('Card', () => {
  it('renders the standard surface', () => {
    const html = renderToStaticMarkup(<Card>Body</Card>);
    expect(html).toContain('Body');
    expect(html).toContain('rounded-[var(--radius-lg)]');
    expect(html).toContain('shadow-[var(--shadow-xs)]');
  });

  it('composes header, body, and footer', () => {
    const html = renderToStaticMarkup(
      <Card>
        <CardHeader title="Recent activity" description="Last 30 days" action={<a>View all</a>} />
        <CardBody>Rows</CardBody>
        <CardFooter>Footer</CardFooter>
      </Card>,
    );
    expect(html).toContain('<h3');
    expect(html).toContain('Recent activity');
    expect(html).toContain('Last 30 days');
    expect(html).toContain('View all');
    expect(html).toContain('Rows');
    expect(html).toContain('Footer');
  });

  it('omits optional header chrome when not given', () => {
    const html = renderToStaticMarkup(<CardHeader title="Plain" />);
    expect(html).toContain('Plain');
    expect(html).not.toContain('icb-text-muted');
  });
});

describe('Logo', () => {
  it('renders the mark as an accessible image', () => {
    const html = renderToStaticMarkup(<IcbMark />);
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="ICB"');
  });

  it('shows the descriptor by default and hides it on request', () => {
    expect(renderToStaticMarkup(<IcbLogo />)).toContain('International Commercial Bank');
    expect(renderToStaticMarkup(<IcbLogo showDescriptor={false} />)).not.toContain(
      'International Commercial Bank',
    );
  });
});
