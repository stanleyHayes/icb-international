import type {
  CursorPage,
  Notification,
  NotificationEvent,
  notificationQuerySchema,
} from '@icb/contracts';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { NotFoundError } from '../../common/errors/index.js';
import { CONFIG, type AppConfiguration } from '../../config/configuration.js';
import { ClockService } from '../../simulation/clock/clock.service.js';
import { CustomerContactReader } from './application/customer-contact.reader.js';
import { NotificationDeliveryService } from './application/notification-delivery.service.js';
import { NotificationPreferencesService } from './application/notification-preferences.service.js';
import { selectChannels, type ChannelDecision } from './domain/channel-selector.js';
import type { NotificationPayload } from './domain/notification-payload.js';
import { toNotification } from './infrastructure/notification.mapper.js';
import { NotificationDoc } from './infrastructure/notification.schemas.js';
import { renderNotification } from './templates/registry.js';
import type { RenderedTemplate } from './templates/template.types.js';

export type NotificationQuery = ReturnType<typeof notificationQuerySchema.parse>;

/** Everything constant across the channels one event fans out to. */
interface FanOutBase {
  readonly customerId: string;
  readonly event: NotificationEvent;
  readonly payload: NotificationPayload;
  readonly rendered: RenderedTemplate;
  readonly recipientEmail: string | null;
  readonly recipientPhone: string | null;
}

/**
 * The module's front door.
 *
 * Other modules call exactly one method — `notify` — and know nothing about channels, templates,
 * preferences, quiet hours or Resend. That is the point: when the transfers module decides a
 * payment failed, it should say so once, not learn how the bank talks to people.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectModel(NotificationDoc.name) private readonly notifications: Model<NotificationDoc>,
    private readonly preferences: NotificationPreferencesService,
    private readonly delivery: NotificationDeliveryService,
    private readonly contacts: CustomerContactReader,
    private readonly clock: ClockService,
    @Inject(CONFIG) private readonly config: AppConfiguration,
  ) {}

  /**
   * Tell a customer something happened.
   *
   * Renders once and fans out across every channel their preferences allow, returning one
   * `Notification` per channel — including the ones quiet hours held back, which come back in
   * state `suppressed` rather than being quietly dropped.
   */
  async notify(
    event: NotificationEvent,
    customerId: string,
    payload: NotificationPayload = {},
  ): Promise<Notification[]> {
    const at = this.clock.now();
    const decisions = await this.decide(event, customerId, at);

    if (decisions.length === 0) {
      this.logger.debug({ event, customerId }, 'Every channel is switched off for this event');
      return [];
    }

    const contact = await this.contacts.forCustomer(customerId);
    const rendered = renderNotification(event, {
      payload,
      bankName: this.config.bank.name,
      recipientName: contact?.displayName ?? 'there',
      occurredAt: at,
    });

    const delivered = await this.fanOut(decisions, {
      customerId,
      event,
      payload,
      rendered,
      recipientEmail: contact?.email ?? null,
      recipientPhone: contact?.phone ?? null,
    });

    return delivered.map(toNotification);
  }

  private async decide(
    event: NotificationEvent,
    customerId: string,
    at: Date,
  ): Promise<ChannelDecision[]> {
    const { preference, quietHours } = await this.preferences.forEvent(customerId, event);
    return selectChannels({
      event,
      preference,
      quietHours,
      at,
      timeZone: this.config.bank.timezone,
    });
  }

  /** Sequential on purpose: channels settle in a predictable order, one event is one burst. */
  private async fanOut(
    decisions: readonly ChannelDecision[],
    base: FanOutBase,
  ): Promise<NotificationDoc[]> {
    const delivered: NotificationDoc[] = [];
    for (const decision of decisions) {
      delivered.push(await this.delivery.deliver({ ...base, decision }));
    }
    return delivered;
  }

  /** The customer's feed. ULID `_id` ordering is creation ordering, so it is also the cursor. */
  async list(customerId: string, query: NotificationQuery): Promise<CursorPage<Notification>> {
    // One extra row answers "is there another page?" without a second count query.
    const rows = await this.notifications
      .find(buildFilter(customerId, query))
      .sort({ _id: -1 })
      .limit(query.limit + 1)
      .lean();

    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;

    return {
      items: page.map(toNotification),
      nextCursor: hasMore ? (page[page.length - 1]?._id ?? null) : null,
      hasMore,
    };
  }

  /** Idempotent: re-reading a read notification is a no-op, not a 404 and not a moved timestamp. */
  async markRead(customerId: string, notificationId: string): Promise<Notification> {
    const updated = await this.notifications
      .findOneAndUpdate(
        { _id: notificationId, customerId, readAt: null },
        { $set: { readAt: this.clock.now() } },
        { new: true },
      )
      .lean();

    if (updated !== null) {
      return toNotification(updated);
    }

    // Ownership is in the filter, so a miss means either "already read" or "not yours".
    const existing = await this.notifications.findOne({ _id: notificationId, customerId }).lean();
    if (existing === null) {
      throw new NotFoundError('Notification', notificationId);
    }
    return toNotification(existing);
  }

  async markAllRead(customerId: string): Promise<{ updated: number }> {
    const result = await this.notifications.updateMany(
      { customerId, readAt: null },
      { $set: { readAt: this.clock.now() } },
    );
    return { updated: result.modifiedCount };
  }

  async unreadCount(customerId: string): Promise<number> {
    return this.notifications.countDocuments({ customerId, readAt: null });
  }
}

function buildFilter(customerId: string, query: NotificationQuery): Record<string, unknown> {
  const filter: Record<string, unknown> = { customerId };
  if (query.cursor !== undefined) {
    filter['_id'] = { $lt: query.cursor };
  }
  if (query.unreadOnly === true) {
    filter['readAt'] = null;
  }
  if (query.event !== undefined && query.event.length > 0) {
    filter['event'] = { $in: query.event };
  }
  return filter;
}
