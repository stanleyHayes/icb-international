import type { SupportMessage } from '@icb/contracts';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { ZodValidationPipe, zodBody } from '../../common/pipes/zod-validation.pipe.js';
import type { AccessTokenClaims } from '../auth/application/token.service.js';
import { CallbackService } from './application/callback.service.js';
import { InboxService } from './application/inbox.service.js';
import { MacroService } from './application/macro.service.js';
import {
  assignTicketRequestSchema,
  callbackCompleteRequestSchema,
  inboxQuerySchema,
  macroCreateRequestSchema,
  macroUpdateRequestSchema,
  staffCallbackQuerySchema,
  staffReplyRequestSchema,
  updateTicketRequestSchema,
  type CallbackView,
  type MacroView,
  type StaffTicketDetail,
  type StaffTicketView,
} from './infrastructure/support-requests.js';
import { SUPPORT_STAFF_ROLES } from './support.constants.js';

/**
 * The support desk, staff side.
 *
 * Separate from the customer controller because the audiences are separate: these routes are
 * role-gated and read any customer's thread rather than the caller's own. The role guard is the
 * boundary; inside it, tickets are looked up by id alone.
 */
@Controller('support/staff')
@UseGuards(RolesGuard)
@Roles(...SUPPORT_STAFF_ROLES)
export class SupportStaffController {
  constructor(
    private readonly inbox: InboxService,
    private readonly macros: MacroService,
    private readonly callbacks: CallbackService,
  ) {}

  /** The work queue, most overdue first. */
  @Get('inbox')
  inboxList(
    @Query(new ZodValidationPipe(inboxQuerySchema))
    query: ReturnType<typeof inboxQuerySchema.parse>,
    @CurrentUser() staff: AccessTokenClaims,
  ): Promise<StaffTicketView[]> {
    return this.inbox.inbox(query, staff);
  }

  @Get('tickets/:ticketId')
  detail(@Param('ticketId') ticketId: string): Promise<StaffTicketDetail> {
    return this.inbox.detail(ticketId);
  }

  @Post('tickets/:ticketId/messages')
  reply(
    @Param('ticketId') ticketId: string,
    @CurrentUser() staff: AccessTokenClaims,
    @Body(zodBody(staffReplyRequestSchema))
    body: ReturnType<typeof staffReplyRequestSchema.parse>,
  ): Promise<SupportMessage> {
    return this.inbox.reply(ticketId, staff, body);
  }

  /** Assign to a named agent, or to the caller when the body carries no staff id. */
  @Post('tickets/:ticketId/assign')
  @HttpCode(HttpStatus.OK)
  assign(
    @Param('ticketId') ticketId: string,
    @CurrentUser() staff: AccessTokenClaims,
    @Body(zodBody(assignTicketRequestSchema))
    body: ReturnType<typeof assignTicketRequestSchema.parse>,
  ): Promise<StaffTicketView> {
    return this.inbox.assign(ticketId, body.staffId, staff);
  }

  /** Least-loaded routing across the active support team. */
  @Post('tickets/:ticketId/auto-assign')
  @HttpCode(HttpStatus.OK)
  autoAssign(@Param('ticketId') ticketId: string): Promise<StaffTicketView> {
    return this.inbox.autoAssign(ticketId);
  }

  /** Priority and status changes; a priority change recomputes the SLA deadline. */
  @Patch('tickets/:ticketId')
  update(
    @Param('ticketId') ticketId: string,
    @Body(zodBody(updateTicketRequestSchema))
    body: ReturnType<typeof updateTicketRequestSchema.parse>,
  ): Promise<StaffTicketView> {
    return this.inbox.update(ticketId, body);
  }

  /** Renders the macro against the ticket and posts it as the agent's reply. */
  @Post('tickets/:ticketId/macros/:macroId/apply')
  @HttpCode(HttpStatus.OK)
  applyMacro(
    @Param('ticketId') ticketId: string,
    @Param('macroId') macroId: string,
    @CurrentUser() staff: AccessTokenClaims,
  ): Promise<SupportMessage> {
    return this.macros.apply(macroId, ticketId, staff);
  }

  @Get('macros')
  listMacros(): Promise<MacroView[]> {
    return this.macros.list();
  }

  @Post('macros')
  createMacro(
    @CurrentUser() staff: AccessTokenClaims,
    @Body(zodBody(macroCreateRequestSchema))
    body: ReturnType<typeof macroCreateRequestSchema.parse>,
  ): Promise<MacroView> {
    return this.macros.create(staff, body);
  }

  @Patch('macros/:macroId')
  updateMacro(
    @Param('macroId') macroId: string,
    @Body(zodBody(macroUpdateRequestSchema))
    body: ReturnType<typeof macroUpdateRequestSchema.parse>,
  ): Promise<MacroView> {
    return this.macros.update(macroId, body);
  }

  @Delete('macros/:macroId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMacro(@Param('macroId') macroId: string): Promise<void> {
    return this.macros.remove(macroId);
  }

  @Get('callbacks')
  listCallbacks(
    @Query(new ZodValidationPipe(staffCallbackQuerySchema))
    query: ReturnType<typeof staffCallbackQuerySchema.parse>,
  ): Promise<CallbackView[]> {
    return this.callbacks.listForStaff(query);
  }

  @Post('callbacks/:callbackId/complete')
  @HttpCode(HttpStatus.OK)
  completeCallback(
    @Param('callbackId') callbackId: string,
    @CurrentUser() staff: AccessTokenClaims,
    @Body(zodBody(callbackCompleteRequestSchema))
    body: ReturnType<typeof callbackCompleteRequestSchema.parse>,
  ): Promise<CallbackView> {
    return this.callbacks.complete(callbackId, staff, body.notes ?? null);
  }

  @Post('callbacks/:callbackId/cancel')
  @HttpCode(HttpStatus.OK)
  cancelCallback(
    @Param('callbackId') callbackId: string,
    @CurrentUser() staff: AccessTokenClaims,
  ): Promise<CallbackView> {
    return this.callbacks.cancel(callbackId, staff);
  }
}
