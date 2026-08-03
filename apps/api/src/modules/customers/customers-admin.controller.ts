import {
  createCustomerNoteRequestSchema,
  setCustomerStatusRequestSchema,
  type CustomerAdminView,
  type CustomerNote,
} from '@icb/contracts';
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';

import { AuditAction } from '../../common/decorators/audit-action.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { zodBody } from '../../common/pipes/zod-validation.pipe.js';
import type { AccessTokenClaims } from '../auth/application/token.service.js';
import { CustomerLifecycleService } from './customer-lifecycle.service.js';
import { CustomerNotesService } from './customer-notes.service.js';

const NOTE_READERS = ['support', 'teller', 'operations', 'compliance', 'admin', 'super_admin'] as const;
const STATUS_WRITERS = ['operations', 'compliance', 'admin', 'super_admin'] as const;

/**
 * The staff side of the customer record: lifecycle transitions and notes.
 *
 * Read-only search and the 360° view live in the admin module's customer directory; this
 * controller owns everything that *changes* a customer. Both mutations carry an audit action —
 * who changed a customer's status, and why, is exactly what an audit trail exists for (N7).
 */
@Controller('admin/customers')
@UseGuards(RolesGuard)
export class CustomersAdminController {
  constructor(
    private readonly lifecycle: CustomerLifecycleService,
    private readonly notes: CustomerNotesService,
  ) {}

  @Post(':customerId/status')
  @HttpCode(HttpStatus.OK)
  @Roles(...STATUS_WRITERS)
  @AuditAction('customer.set_status')
  async setStatus(
    @CurrentUser() staff: AccessTokenClaims,
    @Param('customerId') customerId: string,
    @Body(zodBody(setCustomerStatusRequestSchema))
    body: ReturnType<typeof setCustomerStatusRequestSchema.parse>,
  ): Promise<CustomerAdminView> {
    return this.lifecycle.setStatus(customerId, body, { id: staff.sub, label: staff.email });
  }

  @Get(':customerId/notes')
  @Roles(...NOTE_READERS)
  async listNotes(@Param('customerId') customerId: string): Promise<CustomerNote[]> {
    return this.notes.list(customerId);
  }

  @Post(':customerId/notes')
  @HttpCode(HttpStatus.CREATED)
  @Roles(...NOTE_READERS)
  @AuditAction('customer.note_create')
  async createNote(
    @CurrentUser() staff: AccessTokenClaims,
    @Param('customerId') customerId: string,
    @Body(zodBody(createCustomerNoteRequestSchema))
    body: ReturnType<typeof createCustomerNoteRequestSchema.parse>,
  ): Promise<CustomerNote> {
    return this.notes.create(customerId, body, { id: staff.sub, name: staff.email });
  }
}
