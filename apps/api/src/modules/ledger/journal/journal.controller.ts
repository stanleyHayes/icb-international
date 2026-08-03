import type { CursorPage } from '@icb/contracts';
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';

import { Roles } from '../../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../../common/guards/roles.guard.js';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe.js';
import { journalQuerySchema, type JournalQuery } from './journal.schemas.js';
import { JournalService } from './journal.service.js';
import type { JournalTransaction } from './journal.types.js';

/**
 * The ledger journal: the raw double-entry record, staff-facing.
 *
 * Read-only by construction — postings are immutable (agent_plan.md N5), so there is nothing to
 * mutate here; corrections are new reversing transactions posted through LedgerService.
 */
@Controller('admin/ledger/journal')
@UseGuards(RolesGuard)
@Roles('operations', 'compliance', 'admin', 'super_admin')
export class JournalController {
  constructor(private readonly journal: JournalService) {}

  @Get()
  async list(
    @Query(new ZodValidationPipe(journalQuerySchema)) query: JournalQuery,
  ): Promise<CursorPage<JournalTransaction>> {
    return this.journal.query(query);
  }

  @Get(':transactionId')
  async detail(@Param('transactionId') transactionId: string): Promise<JournalTransaction> {
    return this.journal.detail(transactionId);
  }
}
