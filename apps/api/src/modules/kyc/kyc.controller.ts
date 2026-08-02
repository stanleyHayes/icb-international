import {
  attachDocumentRequestSchema,
  submitKycRequestSchema,
  uploadSignatureRequestSchema,
  type KycCase,
  type KycTierLimits,
  type UploadSignature,
} from '@icb/contracts';
import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';

import { CurrentCustomer } from '../../common/decorators/current-user.decorator.js';
import { zodBody } from '../../common/pipes/zod-validation.pipe.js';
import { KycService } from './kyc.service.js';

/**
 * The customer's side of verification.
 *
 * Every route derives its customer from the verified token. A case id never appears in a
 * customer-facing path, so there is nothing for one customer to guess in order to read another
 * customer's identity documents.
 */
@Controller('kyc')
export class KycController {
  constructor(private readonly kyc: KycService) {}

  @Get('case')
  async currentCase(@CurrentCustomer() customerId: string): Promise<KycCase> {
    return this.kyc.caseFor(customerId);
  }

  /**
   * Mints a short-lived signature so the browser can upload straight to the storage provider.
   * The document bytes never reach this API.
   */
  @Post('upload-signature')
  @HttpCode(HttpStatus.OK)
  uploadSignature(
    @CurrentCustomer() customerId: string,
    @Body(zodBody(uploadSignatureRequestSchema))
    body: ReturnType<typeof uploadSignatureRequestSchema.parse>,
  ): UploadSignature {
    return this.kyc.mintUploadSignature(customerId, body);
  }

  @Post('documents')
  async attachDocument(
    @CurrentCustomer() customerId: string,
    @Body(zodBody(attachDocumentRequestSchema))
    body: ReturnType<typeof attachDocumentRequestSchema.parse>,
  ): Promise<KycCase> {
    return this.kyc.attachDocument(customerId, body);
  }

  @Post('submit')
  @HttpCode(HttpStatus.OK)
  async submit(
    @CurrentCustomer() customerId: string,
    @Body(zodBody(submitKycRequestSchema))
    body: ReturnType<typeof submitKycRequestSchema.parse>,
  ): Promise<KycCase> {
    return this.kyc.submit(customerId, body);
  }

  /** The limits in force for this customer today, plus the tiers they could reach. */
  @Get('limits')
  async limits(
    @CurrentCustomer() customerId: string,
  ): Promise<{ current: KycTierLimits; tiers: KycTierLimits[] }> {
    return { current: await this.kyc.limitsForCustomer(customerId), tiers: this.kyc.listLimits() };
  }
}
