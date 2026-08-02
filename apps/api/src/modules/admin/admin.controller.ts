import type { Kpi, LedgerIntegrityReport, MonitorEntry, TrialBalance } from '@icb/contracts';
import { Controller, Get, UseGuards } from '@nestjs/common';

import { Roles } from '../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { LedgerIntegrityService } from '../ledger/ledger-integrity.service.js';
import { AdminService } from './admin.service.js';

/**
 * Back-office read API.
 *
 * Every route is role-gated. Nothing here mutates: state changes go through the owning domain
 * module so they pick up its rules, audit trail and approval requirements.
 */
@Controller('admin')
@UseGuards(RolesGuard)
@Roles('operations', 'compliance', 'admin', 'super_admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly integrity: LedgerIntegrityService,
  ) {}

  @Get('kpis')
  async kpis(): Promise<{ items: Kpi[] }> {
    return { items: await this.admin.kpis() };
  }

  @Get('trial-balance')
  async trialBalance(): Promise<TrialBalance> {
    return this.admin.trialBalance();
  }

  @Get('monitor')
  async monitor(): Promise<{ items: MonitorEntry[] }> {
    return { items: await this.admin.monitor() };
  }

  @Get('ledger-integrity')
  async ledgerIntegrity(): Promise<LedgerIntegrityReport> {
    return this.integrity.verify();
  }
}
