import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { CustomerDoc, CustomerSchema } from '../customers/infrastructure/customer.schemas.js';
import { StaffUserDoc, StaffUserSchema } from '../iam/infrastructure/iam.schemas.js';
import { AttachmentSignatureService } from './application/attachment-signature.service.js';
import { CallbackService } from './application/callback.service.js';
import { InboxService } from './application/inbox.service.js';
import { MacroService } from './application/macro.service.js';
import { TicketService } from './application/ticket.service.js';
import {
  SupportCallbackDoc,
  SupportCallbackSchema,
  SupportMacroDoc,
  SupportMacroSchema,
  SupportMessageDoc,
  SupportMessageSchema,
  SupportTicketDoc,
  SupportTicketSchema,
} from './infrastructure/support.schemas.js';
import { SupportStaffController } from './support-staff.controller.js';
import { SupportController } from './support.controller.js';

/**
 * Support & messaging (agent_plan.md BE-25).
 *
 * Tickets with priority/SLA/assignment, threaded secure messages with signed direct-to-storage
 * attachments, macros, callback requests and CSAT capture. The customer surface matches
 * `@icb/contracts` exactly; the staff inbox is role-gated to the support desk roles.
 *
 * `CustomerDoc` and `StaffUserDoc` are registered read-only: customer names are denormalised
 * onto tickets at creation, and staff rows feed display names and auto-assignment.
 * `TicketService` is exported so other modules (disputes, complaints flows) can open tickets.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SupportTicketDoc.name, schema: SupportTicketSchema },
      { name: SupportMessageDoc.name, schema: SupportMessageSchema },
      { name: SupportMacroDoc.name, schema: SupportMacroSchema },
      { name: SupportCallbackDoc.name, schema: SupportCallbackSchema },
      { name: CustomerDoc.name, schema: CustomerSchema },
      { name: StaffUserDoc.name, schema: StaffUserSchema },
    ]),
  ],
  controllers: [SupportController, SupportStaffController],
  providers: [
    TicketService,
    InboxService,
    MacroService,
    CallbackService,
    AttachmentSignatureService,
  ],
  exports: [TicketService],
})
export class SupportModule {}
