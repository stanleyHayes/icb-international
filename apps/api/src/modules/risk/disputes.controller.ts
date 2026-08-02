import {
  createDisputeRequestSchema,
  disputeQuerySchema,
  type CreateDisputeRequest,
  type CursorPage,
  type Dispute,
} from '@icb/contracts';
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { z } from 'zod';

import { CurrentCustomer } from '../../common/decorators/current-user.decorator.js';
import { ZodValidationPipe, zodBody } from '../../common/pipes/zod-validation.pipe.js';
import { DisputesService, type DisputeQuery } from './disputes.service.js';

/**
 * Evidence added after the dispute was raised.
 *
 * Composed from the create request's own evidence schema rather than declared afresh, so the two
 * upload paths cannot drift into accepting different shapes.
 */
const attachEvidenceSchema = z.object({
  evidence: createDisputeRequestSchema.shape.evidence,
});

/**
 * The customer's view of a dispute.
 *
 * Every route derives the customer from the verified token, so a dispute id belonging to somebody
 * else resolves to a 404 rather than to their transaction history.
 */
@Controller('disputes')
export class DisputesController {
  constructor(private readonly disputes: DisputesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentCustomer() customerId: string,
    @Body(zodBody(createDisputeRequestSchema)) body: CreateDisputeRequest,
  ): Promise<Dispute> {
    return this.disputes.raise(customerId, body);
  }

  @Get()
  async list(
    @CurrentCustomer() customerId: string,
    @Query(new ZodValidationPipe(disputeQuerySchema)) query: DisputeQuery,
  ): Promise<CursorPage<Dispute>> {
    return this.disputes.listForCustomer(customerId, query);
  }

  @Post(':disputeId/evidence')
  @HttpCode(HttpStatus.OK)
  async attachEvidence(
    @CurrentCustomer() customerId: string,
    @Param('disputeId') disputeId: string,
    @Body(zodBody(attachEvidenceSchema)) body: z.infer<typeof attachEvidenceSchema>,
  ): Promise<Dispute> {
    return this.disputes.attachEvidence(disputeId, customerId, body.evidence);
  }

  @Get(':disputeId')
  async detail(
    @CurrentCustomer() customerId: string,
    @Param('disputeId') disputeId: string,
  ): Promise<Dispute> {
    return this.disputes.getForCustomer(disputeId, customerId);
  }
}
