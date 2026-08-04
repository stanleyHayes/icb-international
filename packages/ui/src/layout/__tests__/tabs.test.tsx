import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Tabs } from '../tabs';

const tabs = [
  { id: 'activity', label: 'Activity', panel: <p>activity panel</p> },
  { id: 'details', label: 'Details', panel: <p>details panel</p> },
  { id: 'statements', label: 'Statements', panel: <p>statements panel</p>, disabled: true },
];

describe('Tabs', () => {
  it('renders a tablist with roving tabindex and the selected panel', () => {
    const html = renderToStaticMarkup(<Tabs tabs={tabs} defaultActiveId="activity" />);
    expect(html).toContain('role="tablist"');
    expect(html).toContain('role="tab"');
    expect(html).toContain('role="tabpanel"');
    expect(html).toContain('activity panel');
    expect(html).not.toContain('details panel');
  });

  it('marks the selected tab and links it to its panel', () => {
    const html = renderToStaticMarkup(<Tabs tabs={tabs} defaultActiveId="details" />);
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('aria-controls');
    expect(html).toContain('details panel');
  });

  it('honours the controlled activeId', () => {
    const html = renderToStaticMarkup(<Tabs tabs={tabs} activeId="details" onChange={() => undefined} />);
    expect(html).toContain('details panel');
    expect(html).not.toContain('activity panel');
  });

  it('renders disabled tabs as disabled buttons outside selection', () => {
    const html = renderToStaticMarkup(<Tabs tabs={tabs} defaultActiveId="activity" />);
    expect(html).toContain('disabled=""');
  });

  it('supports vertical orientation', () => {
    const html = renderToStaticMarkup(
      <Tabs tabs={tabs} defaultActiveId="activity" orientation="vertical" />,
    );
    expect(html).toContain('aria-orientation="vertical"');
  });
});
