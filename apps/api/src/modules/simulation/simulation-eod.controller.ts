import type { EndOfDayReport, LedgerIntegrityReport } from '@icb/contracts';
import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';

import { Roles } from '../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { LedgerIntegrityService } from '../ledger/ledger-integrity.service.js';
import { EndOfDayService } from '../../simulation/eod/end-of-day.service.js';

/**
 * End of day, and the integrity check it ends with.
 *
 * The integrity check is readable by operations and admin as well as `super_admin`: "do the books
 * balance?" is the question a duty officer needs answered at 3am, and making them find someone
 * with the highest role in the bank to answer it is how outages get longer.
 */
@Controller('simulation')
@UseGuards(RolesGuard)
@Roles('super_admin')
export class SimulationEodController {
  constructor(
    private readonly endOfDay: EndOfDayService,
    private readonly integrity: LedgerIntegrityService,
  ) {}

  @Post('eod')
  async run(): Promise<EndOfDayReport> {
    const outcome = await this.endOfDay.run();
    return outcome.report;
  }

  /** The spelling the generated SDK and the OpenAPI document use. */
  @Post('end-of-day')
  async runAlias(): Promise<EndOfDayReport> {
    const outcome = await this.endOfDay.run();
    return outcome.report;
  }

  @Get('eod')
  async history(): Promise<{ items: EndOfDayReport[] }> {
    return { items: await this.endOfDay.history() };
  }

  @Get('eod/:businessDate')
  async forDate(@Param('businessDate') businessDate: string): Promise<EndOfDayReport | null> {
    return this.endOfDay.reportFor(businessDate);
  }

  @Get('ledger-integrity')
  @Roles('operations', 'admin', 'super_admin')
  async ledgerIntegrity(): Promise<LedgerIntegrityReport> {
    return this.integrity.verify();
  }

  @Get('ledger/integrity')
  @Roles('operations', 'admin', 'super_admin')
  async ledgerIntegrityAlias(): Promise<LedgerIntegrityReport> {
    return this.integrity.verify();
  }

  /** The SDK models verification as a command; it is still a read and changes nothing. */
  @Post('ledger/verification')
  @Roles('operations', 'admin', 'super_admin')
  async verifyLedger(): Promise<LedgerIntegrityReport> {
    return this.integrity.verify();
  }
}
