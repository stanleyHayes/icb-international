import {
  amlAlertQuerySchema,
  fileReportRequestSchema,
  updateAmlAlertRequestSchema,
  type AmlAlert,
  type OffsetPage,
} from '@icb/contracts';
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Idempotent } from '../../common/decorators/idempotent.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { ZodValidationPipe, zodBody } from '../../common/pipes/zod-validation.pipe.js';
import type { AccessTokenClaims } from '../auth/application/token.service.js';
import { AML_ROLES } from './aml.roles.js';
import {
  AmlAlertsService,
  type AmlAlertQuery,
  type UpdateAmlAlertRequest,
} from './application/aml-alerts.service.js';
import { AmlReportsService, type FileReportRequest } from './application/reports.service.js';

/**
 * The AML back office.
 *
 * Matches the SDK surface exactly: the alert queue, one alert, case updates, and report filing.
 * Screening and monitoring themselves are services other modules call (KYC at review, transfers
 * on payment, the EOD batch nightly) — they are not HTTP routes, because nothing good comes from
 * letting the internet ask the bank to screen a name.
 *
 * The acting officer is always taken from the verified token, never from a body, so a filing
 * cannot be attributed to somebody else.
 */
@Controller('admin/aml')
@UseGuards(RolesGuard)
@Roles(...AML_ROLES)
export class AmlController {
  constructor(
    private readonly alerts: AmlAlertsService,
    private readonly reports: AmlReportsService,
  ) {}

  @Get('alerts')
  async listAlerts(
    @Query(new ZodValidationPipe(amlAlertQuerySchema)) query: AmlAlertQuery,
  ): Promise<OffsetPage<AmlAlert>> {
    return this.alerts.list(query);
  }

  @Get('alerts/:alertId')
  async getAlert(@Param('alertId') alertId: string): Promise<AmlAlert> {
    return this.alerts.byId(alertId);
  }

  /** Assign, move status, or edit the narrative. Every change lands in the case trail. */
  @Patch('alerts/:alertId')
  async updateAlert(
    @CurrentUser() staff: AccessTokenClaims,
    @Param('alertId') alertId: string,
    @Body(zodBody(updateAmlAlertRequestSchema)) body: UpdateAmlAlertRequest,
  ): Promise<AmlAlert> {
    return this.alerts.update(alertId, { id: staff.sub, label: staff.email }, body);
  }

  /** File a SAR or CTR. Idempotent: a retry with the same kind replays the original filing. */
  @Post('alerts/:alertId/reports')
  @Idempotent()
  async fileReport(
    @CurrentUser() staff: AccessTokenClaims,
    @Param('alertId') alertId: string,
    @Body(zodBody(fileReportRequestSchema)) body: FileReportRequest,
  ): Promise<AmlAlert> {
    return this.reports.fileReport(alertId, { id: staff.sub, label: staff.email }, body);
  }
}
