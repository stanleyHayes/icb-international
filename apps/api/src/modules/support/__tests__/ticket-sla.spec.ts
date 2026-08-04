import { describe, expect, it } from 'vitest';

import { isSlaBreached, slaDeadline } from '../domain/ticket-sla.js';
import { SLA_HOURS_BY_PRIORITY } from '../support.constants.js';

const FILED_AT = new Date('2026-08-02T10:00:00.000Z');

describe('slaDeadline', () => {
  it('gives each priority the deadline from the SLA table', () => {
    for (const [priority, hours] of Object.entries(SLA_HOURS_BY_PRIORITY)) {
      const due = slaDeadline(priority as keyof typeof SLA_HOURS_BY_PRIORITY, FILED_AT);
      expect(due.getTime() - FILED_AT.getTime()).toBe(hours * 3_600_000);
    }
  });

  it('orders urgent tighter than low', () => {
    expect(slaDeadline('urgent', FILED_AT).getTime()).toBeLessThan(
      slaDeadline('low', FILED_AT).getTime(),
    );
  });
});

describe('isSlaBreached', () => {
  const DUE = new Date('2026-08-03T10:00:00.000Z');
  const AFTER = new Date('2026-08-03T10:00:01.000Z');
  const BEFORE = new Date('2026-08-03T09:59:59.000Z');

  it('is breached when an open ticket passes its deadline', () => {
    expect(isSlaBreached('open', DUE, AFTER)).toBe(true);
    expect(isSlaBreached('awaiting_agent', DUE, AFTER)).toBe(true);
    expect(isSlaBreached('awaiting_customer', DUE, AFTER)).toBe(true);
  });

  it('is not breached before the deadline', () => {
    expect(isSlaBreached('open', DUE, BEFORE)).toBe(false);
  });

  it('stops the clock once the ticket is resolved or closed', () => {
    expect(isSlaBreached('resolved', DUE, AFTER)).toBe(false);
    expect(isSlaBreached('closed', DUE, AFTER)).toBe(false);
  });

  it('treats a missing deadline as no breach', () => {
    expect(isSlaBreached('open', null, AFTER)).toBe(false);
  });
});
