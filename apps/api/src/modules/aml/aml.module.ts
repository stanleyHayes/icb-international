import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AccountDoc, AccountSchema } from '../accounts/infrastructure/account.schemas.js';
import { CustomerDoc, CustomerSchema } from '../customers/infrastructure/customer.schemas.js';
import { LedgerModule } from '../ledger/ledger.module.js';
import { TransferDoc, TransferSchema } from '../transfers/infrastructure/transfer.schemas.js';
import { AmlController } from './aml.controller.js';
import { AmlAlertsService } from './application/aml-alerts.service.js';
import { MonitoringContextService } from './application/monitoring-context.service.js';
import { AmlMonitoringService } from './application/monitoring.service.js';
import { AmlReportsService } from './application/reports.service.js';
import { AmlScreeningService } from './application/screening.service.js';
import { AmlAlertDoc, AmlAlertSchema } from './infrastructure/aml-alert.schemas.js';

/**
 * AML & compliance.
 *
 * LedgerModule supplies the entry history monitoring reads (read-only — nothing here posts, so
 * no balance invariants are touched). Accounts, customers and transfers are read through their
 * Mongoose models the same way the risk module reads them.
 *
 * Exports are the integration surface: KYC calls `AmlScreeningService` at review time, the
 * transfers flow calls it for counterparties, and the EOD batch calls `AmlMonitoringService`
 * so the monitoring scenarios run nightly.
 */
@Module({
  imports: [
    LedgerModule,
    MongooseModule.forFeature([
      { name: AmlAlertDoc.name, schema: AmlAlertSchema },
      { name: AccountDoc.name, schema: AccountSchema },
      { name: CustomerDoc.name, schema: CustomerSchema },
      { name: TransferDoc.name, schema: TransferSchema },
    ]),
  ],
  controllers: [AmlController],
  providers: [
    AmlAlertsService,
    AmlScreeningService,
    AmlMonitoringService,
    MonitoringContextService,
    AmlReportsService,
  ],
  exports: [AmlAlertsService, AmlScreeningService, AmlMonitoringService],
})
export class AmlModule {}
