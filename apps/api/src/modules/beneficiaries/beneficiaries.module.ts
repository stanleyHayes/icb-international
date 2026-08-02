import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AccountsModule } from '../accounts/accounts.module.js';
import { LedgerModule } from '../ledger/ledger.module.js';
import { BeneficiaryTargetResolver } from './application/beneficiary-target.resolver.js';
import { BeneficiariesController } from './beneficiaries.controller.js';
import { BeneficiariesService } from './beneficiaries.service.js';
import { BeneficiaryVerificationController } from './beneficiary-verification.controller.js';
import { BeneficiaryVerificationService } from './beneficiary-verification.service.js';
import {
  BeneficiaryDoc,
  BeneficiarySchema,
} from './infrastructure/beneficiary.schemas.js';

/**
 * Saved payees and their fraud controls.
 *
 * `BeneficiariesService` is exported because transfers must call `assertUsable()` before paying a
 * saved payee, and `recordUsage()` after — the cooling-off cap is worth nothing if a rail can
 * route around it.
 */
@Module({
  imports: [
    LedgerModule,
    AccountsModule,
    MongooseModule.forFeature([{ name: BeneficiaryDoc.name, schema: BeneficiarySchema }]),
  ],
  controllers: [BeneficiariesController, BeneficiaryVerificationController],
  providers: [BeneficiariesService, BeneficiaryVerificationService, BeneficiaryTargetResolver],
  exports: [BeneficiariesService, BeneficiaryVerificationService, MongooseModule],
})
export class BeneficiariesModule {}
