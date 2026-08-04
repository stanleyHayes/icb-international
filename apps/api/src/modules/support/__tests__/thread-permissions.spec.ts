import { describe, expect, it } from 'vitest';

import { TicketClosedError, SatisfactionNotAllowedError } from '../domain/support-errors.js';
import {
  assertReplyAllowed,
  assertSatisfactionAllowed,
  canAccessThread,
  statusAfterReply,
} from '../domain/thread-permissions.js';

describe('canAccessThread', () => {
  it('lets the owning customer read their thread', () => {
    expect(canAccessThread('cus-1', { customerId: 'cus-1', staff: false })).toBe(true);
  });

  it('denies another customer — the IDOR case', () => {
    expect(canAccessThread('cus-1', { customerId: 'cus-2', staff: false })).toBe(false);
  });

  it('lets staff read any thread', () => {
    expect(canAccessThread('cus-1', { customerId: null, staff: true })).toBe(true);
  });
});

describe('assertReplyAllowed', () => {
  it('accepts replies on open and resolved tickets', () => {
    expect(() => assertReplyAllowed('t-1', 'open')).not.toThrow();
    expect(() => assertReplyAllowed('t-1', 'awaiting_customer')).not.toThrow();
    expect(() => assertReplyAllowed('t-1', 'resolved')).not.toThrow();
  });

  it('rejects a reply on a closed ticket', () => {
    expect(() => assertReplyAllowed('t-1', 'closed')).toThrow(TicketClosedError);
  });
});

describe('statusAfterReply', () => {
  it('hands the ball to the other side of the thread', () => {
    expect(statusAfterReply('customer')).toBe('awaiting_agent');
    expect(statusAfterReply('agent')).toBe('awaiting_customer');
  });
});

describe('assertSatisfactionAllowed', () => {
  it('allows a first rating once the ticket is resolved', () => {
    expect(() =>
      assertSatisfactionAllowed({ _id: 't-1', status: 'resolved', satisfaction: null }),
    ).not.toThrow();
    expect(() =>
      assertSatisfactionAllowed({ _id: 't-1', status: 'closed', satisfaction: null }),
    ).not.toThrow();
  });

  it('rejects a rating while the ticket is still open', () => {
    expect(() =>
      assertSatisfactionAllowed({ _id: 't-1', status: 'open', satisfaction: null }),
    ).toThrow(SatisfactionNotAllowedError);
  });

  it('rejects a second rating', () => {
    expect(() =>
      assertSatisfactionAllowed({
        _id: 't-1',
        status: 'resolved',
        satisfaction: { rating: 5, comment: null, ratedAt: new Date('2026-08-02') },
      }),
    ).toThrow(SatisfactionNotAllowedError);
  });
});
