import type { AmlAlert, CaseStatus, fileReportRequestSchema } from '@icb/contracts';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { ConflictError } from '../../../common/errors/index.js';
import { newReference } from '../../../infrastructure/database/identifier.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { ACTIONABLE_STATUSES } from '../domain/case-workflow.js';
import { buildReportDraft } from '../domain/narrative.js';
import { AmlAlertDoc } from '../infrastructure/aml-alert.schemas.js';
import { toAmlAlert } from '../infrastructure/aml.mapper.js';
import { AmlAlertsService, type StaffActor } from './aml-alerts.service.js';

export type FileReportRequest = ReturnType<typeof fileReportRequestSchema.parse>;

const REPORT_PREFIX: Readonly<Record<FileReportRequest['kind'], string>> = {
  sar: 'SAR',
  ctr: 'CTR',
};

/**
 * SAR/CTR filing.
 *
 * Filing is the terminal act of a case: it stores the generated draft verbatim, pins the
 * analyst's final narrative onto the alert, and closes the case — a report about an open case is
 * a contradiction, and a filed draft that could be edited afterwards would not be evidence.
 *
 * Re-filing the same report kind returns the existing record rather than erroring: the endpoint
 * is declared idempotent in the SDK, and until the idempotency interceptor's store lands, the
 * service itself provides the replay guarantee.
 */
@Injectable()
export class AmlReportsService {
  private readonly logger = new Logger(AmlReportsService.name);

  constructor(
    @InjectModel(AmlAlertDoc.name) private readonly alerts: Model<AmlAlertDoc>,
    private readonly alertQueue: AmlAlertsService,
    private readonly clock: ClockService,
  ) {}

  async fileReport(
    alertId: string,
    staff: StaffActor,
    request: FileReportRequest,
  ): Promise<AmlAlert> {
    const row = await this.alertQueue.require(alertId);
    this.assertFileable(alertId, row, request.kind);

    if (row.filedReport) {
      return toAmlAlert(row);
    }

    const now = this.clock.now();
    const reference = newReference(REPORT_PREFIX[request.kind]);
    await this.alerts.updateOne(
      { _id: alertId },
      {
        $set: {
          narrative: request.narrative,
          status: 'closed',
          updatedAt: now,
          filedReport: {
            kind: request.kind,
            reference,
            filedAt: now,
            draft: this.draftFor(row, { kind: request.kind, reference, by: staff.label, at: now }),
          },
        },
        $push: {
          trail: this.alertQueue.entry(staff.label, 'file', `filed ${request.kind.toUpperCase()} ${reference}`),
        },
      },
    );

    this.logger.warn({ alertId, kind: request.kind, reference }, 'AML report filed');
    return this.alertQueue.byId(alertId);
  }

  /** A same-kind re-file is a replay; a different kind or a dead case is a conflict. */
  private assertFileable(alertId: string, row: AmlAlertDoc, kind: FileReportRequest['kind']): void {
    if (row.filedReport && row.filedReport.kind !== kind) {
      throw new ConflictError('A report of a different kind has already been filed for this alert', {
        alertId,
        filed: row.filedReport.kind,
      });
    }
    if (!row.filedReport && !ACTIONABLE_STATUSES.includes(row.status as CaseStatus)) {
      throw new ConflictError('Reports can only be filed from an open case', { alertId });
    }
  }

  private draftFor(
    row: AmlAlertDoc,
    filing: { kind: FileReportRequest['kind']; reference: string; by: string; at: Date },
  ): string {
    return buildReportDraft({
      reportKind: filing.kind,
      reference: filing.reference,
      customerName: row.customerName,
      customerId: row.customerId,
      alertKind: row.kind as AmlAlert['kind'],
      matchDetail: row.matchDetail,
      aggregateMinorUnits: row.aggregateMinorUnits,
      currency: row.currency,
      transactionCount: row.relatedTransactionIds.length,
      preparedBy: filing.by,
      preparedAt: filing.at,
    });
  }
}
