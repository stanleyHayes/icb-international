import {
  notificationQuerySchema,
  updateNotificationPreferencesRequestSchema,
  type CursorPage,
  type Notification,
} from '@icb/contracts';
import { Body, Controller, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';

import { CurrentCustomer } from '../../common/decorators/current-user.decorator.js';
import { ZodValidationPipe, zodBody } from '../../common/pipes/zod-validation.pipe.js';
import { NotificationPreferencesService } from './application/notification-preferences.service.js';
import type { ResolvedPreferences, UpdatePreferencesRequest } from './domain/preference.types.js';
import { NotificationsService } from './notifications.service.js';

/**
 * Every handler derives the customer from the verified token, never from the path or body, so
 * there is no request shape that can reach another customer's notifications.
 */
@Controller('notifications')
export class NotificationsController {
  private readonly queryValidator = new ZodValidationPipe(notificationQuerySchema);

  constructor(
    private readonly notifications: NotificationsService,
    private readonly preferences: NotificationPreferencesService,
  ) {}

  @Get()
  async list(
    @CurrentCustomer() customerId: string,
    @Query() query: Record<string, unknown>,
  ): Promise<CursorPage<Notification>> {
    return this.notifications.list(customerId, this.queryValidator.transform(widen(query)));
  }

  @Get('preferences')
  async listPreferences(@CurrentCustomer() customerId: string): Promise<ResolvedPreferences> {
    return this.preferences.resolve(customerId);
  }

  @Put('preferences')
  async updatePreferences(
    @CurrentCustomer() customerId: string,
    @Body(zodBody(updateNotificationPreferencesRequestSchema)) body: UpdatePreferencesRequest,
  ): Promise<ResolvedPreferences> {
    return this.preferences.update(customerId, body);
  }

  @Post('read-all')
  @HttpCode(200)
  async readAll(@CurrentCustomer() customerId: string): Promise<{ updated: number }> {
    return this.notifications.markAllRead(customerId);
  }

  @Post(':notificationId/read')
  @HttpCode(200)
  async read(
    @CurrentCustomer() customerId: string,
    @Param('notificationId') notificationId: string,
  ): Promise<Notification> {
    return this.notifications.markRead(customerId, notificationId);
  }
}

/**
 * `?event=transfer_sent` arrives as a string and `?event=a&event=b` as an array, but the
 * contract declares an array either way. Widening here keeps the transport quirk out of the
 * contract and out of the service.
 */
function widen(query: Record<string, unknown>): Record<string, unknown> {
  const event = query['event'];
  return typeof event === 'string' ? { ...query, event: [event] } : query;
}
