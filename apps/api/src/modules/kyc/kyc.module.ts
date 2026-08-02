import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { CustomerDoc, CustomerSchema } from '../customers/infrastructure/customer.schemas.js';
import { KycCaseDoc, KycCaseSchema } from './infrastructure/kyc.schemas.js';
import { KycDecisionService } from './application/kyc-decision.service.js';
import { KycQueueService } from './application/kyc-queue.service.js';
import { UploadSignatureService } from './application/upload-signature.service.js';
import { KycStaffController } from './kyc-staff.controller.js';
import { KycController } from './kyc.controller.js';
import { KycService } from './kyc.service.js';

/**
 * KYC.
 *
 * `KycService` is exported because the tier limits it owns are enforced elsewhere — the transfer
 * pipeline asks this module what a customer may move rather than keeping its own copy of the
 * table, so there is exactly one definition of a tier in the system.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: KycCaseDoc.name, schema: KycCaseSchema },
      { name: CustomerDoc.name, schema: CustomerSchema },
    ]),
  ],
  controllers: [KycController, KycStaffController],
  providers: [KycService, KycQueueService, KycDecisionService, UploadSignatureService],
  exports: [KycService, MongooseModule],
})
export class KycModule {}
