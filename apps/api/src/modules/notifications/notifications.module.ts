import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import {
  CustomerDoc,
  CustomerSchema,
} from '../customers/infrastructure/customer.schemas.js';
import { CustomerContactReader } from './application/customer-contact.reader.js';
import { NotificationDeliveryService } from './application/notification-delivery.service.js';
import { NotificationPreferencesService } from './application/notification-preferences.service.js';
import { EMAIL_TRANSPORT } from './domain/email-transport.js';
import { emailTransportProvider } from './infrastructure/email-transport.provider.js';
import {
  NotificationPreferenceDoc,
  NotificationPreferenceSchema,
} from './infrastructure/notification-preference.schemas.js';
import { NotificationDoc, NotificationSchema } from './infrastructure/notification.schemas.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';
import { ResendWebhookController } from './webhooks/resend-webhook.controller.js';
import { ResendWebhookService } from './webhooks/resend-webhook.service.js';

/**
 * Notifications (agent_plan.md BE-21).
 *
 * `NotificationsService` is exported so any module can call `notify(...)`; the transport token is
 * exported too, so a test can override the binding without knowing which adapter is live.
 * `CustomerDoc` is registered read-only here — this module needs an address, not the ability to
 * change a customer.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: NotificationDoc.name, schema: NotificationSchema },
      { name: NotificationPreferenceDoc.name, schema: NotificationPreferenceSchema },
      { name: CustomerDoc.name, schema: CustomerSchema },
    ]),
  ],
  controllers: [NotificationsController, ResendWebhookController],
  providers: [
    emailTransportProvider,
    NotificationsService,
    NotificationDeliveryService,
    NotificationPreferencesService,
    CustomerContactReader,
    ResendWebhookService,
  ],
  exports: [NotificationsService, NotificationPreferencesService, EMAIL_TRANSPORT],
})
export class NotificationsModule {}
