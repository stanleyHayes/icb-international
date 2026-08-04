import type { Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import { NotFoundError, ValidationError } from '../../../common/errors/index.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import type { AccessTokenClaims } from '../../auth/application/token.service.js';
import { TemplateOverrideService } from '../application/template-override.service.js';
import type { ContentTemplateOverrideDoc } from '../infrastructure/content.schemas.js';

const NOW = new Date('2026-08-02T12:00:00.000Z');
const STAFF = { sub: 'staff-1' } as AccessTokenClaims;

function overrideDoc(
  overrides: Partial<ContentTemplateOverrideDoc> = {},
): ContentTemplateOverrideDoc {
  return {
    _id: 'tpl-1',
    key: 'transfer_sent',
    channel: 'email',
    subject: 'You sent {{amount}} {{currency}}',
    body: 'Hi {{recipientName}}, you sent {{amount}} {{currency}}.',
    updatedBy: 'staff-1',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function setup(saved: ContentTemplateOverrideDoc | null = overrideDoc()) {
  const overrides = {
    find: vi.fn(() => ({
      sort: vi.fn(() => ({ lean: vi.fn().mockResolvedValue([overrideDoc()]) })),
    })),
    findOneAndUpdate: vi.fn(() => ({ lean: vi.fn().mockResolvedValue(saved) })),
    deleteOne: vi.fn().mockResolvedValue({ deletedCount: 1 }),
  };
  const clock = new ClockService();
  clock.freeze(NOW);
  const service = new TemplateOverrideService(
    overrides as unknown as Model<ContentTemplateOverrideDoc>,
    clock,
  );
  return { service, overrides };
}

describe('TemplateOverrideService', () => {
  it('upserts on (key, channel) and records the editor', async () => {
    const { service, overrides } = setup();
    const view = await service.upsert(STAFF, {
      key: 'transfer_sent',
      channel: 'email',
      subject: 'You sent {{amount}}',
      body: 'Hi {{recipientName}}.',
    });
    const [filter, update, options] = overrides.findOneAndUpdate.mock.calls[0] as unknown as [
      Record<string, unknown>,
      { $set: Record<string, unknown> },
      Record<string, unknown>,
    ];
    expect(filter).toEqual({ key: 'transfer_sent', channel: 'email' });
    expect(update.$set['updatedBy']).toBe('staff-1');
    expect(update.$set['updatedAt']).toEqual(NOW);
    expect(options['upsert']).toBe(true);
    expect(view.id).toBe('tpl-1');
  });

  it('previews subject and body against the built-in sample', () => {
    const { service } = setup();
    const preview = service.preview({
      key: 'transfer_sent',
      channel: 'email',
      subject: 'You sent {{amount}} {{currency}}',
      body: 'Hi {{recipientName}}, ref {{reference}}.',
    });
    expect(preview.subject).toBe('You sent 1,250.00 GHS');
    expect(preview.body).toBe('Hi Amara, ref TRF-8F3K2M9Q.');
  });

  it('lets the form override sample facts but not occurredAt', () => {
    const { service } = setup();
    const preview = service.preview({
      key: 'security_alert',
      channel: 'sms',
      subject: '',
      body: 'At {{occurredAt}} for {{recipientName}}',
      sample: { occurredAt: 'forged' },
    });
    expect(preview.body).toBe(`At ${NOW.toISOString()} for Amara`);
  });

  it('fails loudly on unknown variables instead of rendering them', () => {
    const { service } = setup();
    expect(() =>
      service.preview({ key: 'k', channel: 'sms', subject: '', body: 'Hi {{custmerName}}' }),
    ).toThrow(ValidationError);
  });

  it('throws NotFoundError when deleting a missing override', async () => {
    const { service, overrides } = setup();
    overrides.deleteOne.mockResolvedValue({ deletedCount: 0 });
    await expect(service.remove('missing')).rejects.toBeInstanceOf(NotFoundError);
  });
});
