import type { CursorPage, Notification } from '@icb/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { type NotificationPreferencesService } from '../application/notification-preferences.service.js';
import type { ResolvedPreferences } from '../domain/preference.types.js';
import { NotificationsController } from '../notifications.controller.js';
import { type NotificationsService } from '../notifications.service.js';

const PAGE: CursorPage<Notification> = { items: [], nextCursor: null, hasMore: false };
const PREFERENCES = { email: true } as unknown as ResolvedPreferences;

describe('NotificationsController', () => {
  let notifications: {
    list: ReturnType<typeof vi.fn>;
    markAllRead: ReturnType<typeof vi.fn>;
    markRead: ReturnType<typeof vi.fn>;
  };
  let preferences: { resolve: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  let controller: NotificationsController;

  beforeEach(() => {
    notifications = {
      list: vi.fn().mockResolvedValue(PAGE),
      markAllRead: vi.fn().mockResolvedValue({ updated: 3 }),
      markRead: vi.fn().mockResolvedValue({ id: 'notif-1', read: true }),
    };
    preferences = {
      resolve: vi.fn().mockResolvedValue(PREFERENCES),
      update: vi.fn().mockResolvedValue(PREFERENCES),
    };
    controller = new NotificationsController(
      notifications as unknown as NotificationsService,
      preferences as unknown as NotificationPreferencesService,
    );
  });

  it('lists notifications with the validated query for the token customer', async () => {
    const result = await controller.list('cust-1', { unreadOnly: 'true' });

    expect(notifications.list).toHaveBeenCalledWith('cust-1', {
      limit: expect.any(Number),
      unreadOnly: true,
    });
    expect(result).toBe(PAGE);
  });

  it('widens a single ?event= string into the array the contract declares', async () => {
    await controller.list('cust-1', { event: 'transfer_sent' });

    expect(notifications.list).toHaveBeenCalledWith(
      'cust-1',
      expect.objectContaining({ event: ['transfer_sent'] }),
    );
  });

  it('passes a repeated ?event= array through unchanged', async () => {
    await controller.list('cust-1', { event: ['transfer_sent', 'card_declined'] });

    expect(notifications.list).toHaveBeenCalledWith(
      'cust-1',
      expect.objectContaining({ event: ['transfer_sent', 'card_declined'] }),
    );
  });

  it('rejects an invalid query before reaching the service', async () => {
    await expect(controller.list('cust-1', { limit: 'not-a-number' })).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
    expect(notifications.list).not.toHaveBeenCalled();
  });

  it('resolves the caller notification preferences', async () => {
    const result = await controller.listPreferences('cust-1');

    expect(preferences.resolve).toHaveBeenCalledWith('cust-1');
    expect(result).toBe(PREFERENCES);
  });

  it('updates the caller notification preferences', async () => {
    const body = { channels: { email: false } };

    const result = await controller.updatePreferences('cust-1', body as never);

    expect(preferences.update).toHaveBeenCalledWith('cust-1', body);
    expect(result).toBe(PREFERENCES);
  });

  it('marks every notification read and reports the count', async () => {
    const result = await controller.readAll('cust-1');

    expect(notifications.markAllRead).toHaveBeenCalledWith('cust-1');
    expect(result).toEqual({ updated: 3 });
  });

  it('marks a single notification read for the caller', async () => {
    const result = await controller.read('cust-1', 'notif-1');

    expect(notifications.markRead).toHaveBeenCalledWith('cust-1', 'notif-1');
    expect(result).toEqual({ id: 'notif-1', read: true });
  });
});
