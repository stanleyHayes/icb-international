import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AccountsModule } from '../accounts/accounts.module.js';
import { CustomerDoc, CustomerSchema } from '../customers/infrastructure/customer.schemas.js';
import { LedgerModule } from '../ledger/ledger.module.js';
import { DisputeCreditService } from './application/dispute-credit.service.js';
import { DisputeStageService } from './application/dispute-stage.service.js';
import { DisputeSubjectResolver } from './application/dispute-subject.resolver.js';
import { RiskCasesService } from './application/risk-cases.service.js';
import { RiskContextService } from './application/risk-context.service.js';
import { RiskRulesService } from './application/risk-rules.service.js';
import { DisputesAdminController } from './disputes-admin.controller.js';
import { DisputesController } from './disputes.controller.js';
import { DisputesService } from './disputes.service.js';
import { DisputeDoc, DisputeSchema } from './infrastructure/dispute.schemas.js';
import {
  RiskAssessmentDoc,
  RiskAssessmentSchema,
  RiskCaseDoc,
  RiskCaseSchema,
} from './infrastructure/risk-case.schemas.js';
import {
  RiskProfileDoc,
  RiskProfileSchema,
  RiskRuleDoc,
  RiskRuleSchema,
  RiskSettingsDoc,
  RiskSettingsSchema,
} from './infrastructure/risk-rule.schemas.js';
import { RiskController } from './risk.controller.js';
import { RiskService } from './risk.service.js';

/**
 * Risk, fraud and disputes.
 *
 * LedgerModule supplies both the postings a dispute makes (provisional credit against GL 5100,
 * and its reversal) and the entry history the rules measure a customer against; AccountsModule
 * supplies ownership. Nothing in here writes a balance itself.
 *
 * `DisputesAdminController` is listed before `DisputesController` so the static `/disputes/admin`
 * routes are never shadowed by the customer controller's `:disputeId` parameter.
 */
@Module({
  imports: [
    LedgerModule,
    AccountsModule,
    MongooseModule.forFeature([
      { name: RiskRuleDoc.name, schema: RiskRuleSchema },
      { name: RiskSettingsDoc.name, schema: RiskSettingsSchema },
      { name: RiskProfileDoc.name, schema: RiskProfileSchema },
      { name: RiskAssessmentDoc.name, schema: RiskAssessmentSchema },
      { name: RiskCaseDoc.name, schema: RiskCaseSchema },
      { name: DisputeDoc.name, schema: DisputeSchema },
      { name: CustomerDoc.name, schema: CustomerSchema },
    ]),
  ],
  controllers: [DisputesAdminController, DisputesController, RiskController],
  providers: [
    RiskService,
    RiskRulesService,
    RiskCasesService,
    RiskContextService,
    DisputesService,
    DisputeStageService,
    DisputeCreditService,
    DisputeSubjectResolver,
  ],
  exports: [RiskService, RiskRulesService, RiskCasesService, DisputesService],
})
export class RiskModule {}
