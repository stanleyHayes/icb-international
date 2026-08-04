import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Timeline, type TimelineItem } from '../timeline';

const ITEMS: TimelineItem[] = [
  {
    id: '1',
    title: 'Application submitted',
    description: 'Received and queued for review.',
    timestamp: '2026-01-10T09:30:00Z',
    tone: 'success',
  },
  {
    id: '2',
    title: 'Documents requested',
    timestamp: '2026-01-11T14:05:00Z',
    tone: 'warning',
  },
];

describe('Timeline', () => {
  it('renders items as an ordered list with timestamps', () => {
    const html = renderToStaticMarkup(<Timeline items={ITEMS} />);
    expect(html).toContain('<ol');
    expect(html).toContain('Application submitted');
    expect(html).toContain('Documents requested');
    expect(html).toContain('<time');
    expect(html).toContain('2026-01-10T09:30:00.000Z');
  });

  it('renders descriptions only when present', () => {
    const html = renderToStaticMarkup(<Timeline items={ITEMS} />);
    expect(html).toContain('Received and queued for review.');
  });

  it('keeps the caller’s order', () => {
    const html = renderToStaticMarkup(<Timeline items={ITEMS} />);
    expect(html.indexOf('Application submitted')).toBeLessThan(html.indexOf('Documents requested'));
  });
});
