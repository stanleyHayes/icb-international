import {
  verifyBeneficiaryRequestSchema,
  type BeneficiaryVerification,
} from '@icb/contracts';
import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import { CurrentCustomer } from '../../common/decorators/current-user.decorator.js';
import { zodBody } from '../../common/pipes/zod-validation.pipe.js';
import { BeneficiaryVerificationService } from './beneficiary-verification.service.js';

/**
 * The micro-deposit flow.
 *
 * Kept on its own controller because it is a state machine with its own failure modes, not a
 * sixth CRUD verb — and because the attempt budget deserves to be greppable in one file.
 */
@Controller('beneficiaries')
export class BeneficiaryVerificationController {
  constructor(private readonly verification: BeneficiaryVerificationService) {}

  @Post(':beneficiaryId/verify/send')
  async send(
    @CurrentCustomer() customerId: string,
    @Param('beneficiaryId') beneficiaryId: string,
  ): Promise<BeneficiaryVerification> {
    return this.verification.sendMicroDeposits(customerId, beneficiaryId);
  }

  @Post(':beneficiaryId/verify/confirm')
  async confirm(
    @CurrentCustomer() customerId: string,
    @Param('beneficiaryId') beneficiaryId: string,
    @Body(zodBody(verifyBeneficiaryRequestSchema))
    body: ReturnType<typeof verifyBeneficiaryRequestSchema.parse>,
  ): Promise<BeneficiaryVerification> {
    return this.verification.confirm(customerId, beneficiaryId, {
      first: body.firstAmountMinorUnits,
      second: body.secondAmountMinorUnits,
    });
  }

  @Get(':beneficiaryId/verify')
  async status(
    @CurrentCustomer() customerId: string,
    @Param('beneficiaryId') beneficiaryId: string,
  ): Promise<BeneficiaryVerification> {
    return this.verification.status(customerId, beneficiaryId);
  }
}
