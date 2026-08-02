import { NOTIFICATION_EVENTS } from '@icb/contracts';
import { describe, expect, it } from 'vitest';

import { renderNotification } from './registry.js';
import type { TemplateContext } from './template.types.js';

const BASE: Omit<TemplateContext, 'payload'> = {
  bankName: 'International Commercial Bank',
  recipientName: 'Ama',
  occurredAt: new Date(Date.UTC(2026, 7, 2, 12, 5, 0)),
};

describe('template registry', () => {
  it('renders every contract event, even with nothing in the payload', () => {
    for (const event of NOTIFICATION_EVENTS) {
      const rendered = renderNotification(event, { ...BASE, payload: {} });

      expect(rendered.subject.length, event).toBeGreaterThan(0);
      expect(rendered.html.startsWith('<!doctype html>'), event).toBe(true);
      expect(rendered.text.length, event).toBeGreaterThan(0);
      expect(rendered.summary.length, event).toBeGreaterThan(0);
      // The single most common template bug: a missing fact printed as the word "undefined".
      expect(`${rendered.subject} ${rendered.text}`, event).not.toContain('undefined');
    }
  });

  it('carries the ICB brand into the HTML without an external asset', () => {
    const rendered = renderNotification('statement_ready', {
      ...BASE,
      // The primary colour lives on the call to action, so the assertion needs one.
      payload: { period: 'July 2026', actionUrl: 'https://app.icb.example/statements/1' },
    });

    expect(rendered.html).toContain('#0B2C4D');
    expect(rendered.html).toContain('#0F4C81');
    expect(rendered.html).toContain('#C9A227');
    expect(rendered.html).toContain('Outfit');
    expect(rendered.html).not.toContain('<link');
    expect(rendered.html).not.toContain('<img');
  });

  it('formats money from minor units and never as a float', () => {
    const rendered = renderNotification('transfer_sent', {
      ...BASE,
      payload: {
        amount: { minorUnits: 125_000, currency: 'USD', scale: 2 },
        counterparty: 'Kwame Mensah',
        accountLabel: 'Everyday Current 4021',
        reference: 'TRF-8F3K2M9Q',
      },
    });

    expect(rendered.subject).toBe('You sent $1,250.00');
    expect(rendered.text).toContain('$1,250.00');
    expect(rendered.text).toContain('TRF-8F3K2M9Q');
    expect(rendered.html).toContain('$1,250.00');
  });

  it('escapes payload values that reach the HTML', () => {
    const rendered = renderNotification('card_transaction', {
      ...BASE,
      payload: { merchant: '<script>alert(1)</script>' },
    });

    expect(rendered.html).not.toContain('<script>');
    expect(rendered.html).toContain('&lt;script&gt;');
  });

  it('refuses to turn an unsafe scheme into a link', () => {
    const rendered = renderNotification('security_alert', {
      ...BASE,
      payload: { actionUrl: 'javascript:alert(1)', device: 'iPhone 17' },
    });

    expect(rendered.html).not.toContain('javascript:');
    expect(rendered.text).not.toContain('javascript:');
  });

  it('renders an https deep link as the call to action', () => {
    const url = 'https://app.icb.example/transfers/TRF-1';
    const rendered = renderNotification('transfer_sent', { ...BASE, payload: { actionUrl: url } });

    expect(rendered.html).toContain(`href="${url}"`);
    expect(rendered.text).toContain(url);
  });

  it('keeps the in-app summary short and free of the email furniture', () => {
    const rendered = renderNotification('low_balance', {
      ...BASE,
      payload: { balance: { minorUnits: 1_250, currency: 'USD', scale: 2 } },
    });

    expect(rendered.summary).not.toContain('Hello');
    expect(rendered.summary).not.toContain('password');
    expect(rendered.summary.length).toBeLessThan(rendered.text.length);
  });

  it('puts the anti-phishing line on every message', () => {
    for (const event of NOTIFICATION_EVENTS) {
      const rendered = renderNotification(event, { ...BASE, payload: {} });
      expect(rendered.text, event).toContain('never ask you for your password');
    }
  });
});
