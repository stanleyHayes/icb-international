import { billPaymentQuerySchema, type BillPayment, type CursorPage } from '@icb/contracts';
import { Controller, Get, Param, Post, Query } from '@nestjs/common';

import { CurrentCustomer } from '../../common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { BillPaymentsService } from './bill-payments.service.js';

/** Bill payment history, and the one state change a customer can still make to a payment. */
@Controller('bill-payments')
export class BillPaymentsController {
  constructor(private readonly payments: BillPaymentsService) {}

  @Get()
  async list(
    @CurrentCustomer() customerId: string,
    @Query(new ZodValidationPipe(billPaymentQuerySchema))
    query: ReturnType<typeof billPaymentQuerySchema.parse>,
  ): Promise<CursorPage<BillPayment>> {
    return this.payments.list(customerId, query);
  }

  @Get(':paymentId')
  async detail(
    @CurrentCustomer() customerId: string,
    @Param('paymentId') paymentId: string,
  ): Promise<BillPayment> {
    return this.payments.getForCustomer(paymentId, customerId);
  }

  @Post(':paymentId/cancel')
  async cancel(
    @CurrentCustomer() customerId: string,
    @Param('paymentId') paymentId: string,
  ): Promise<BillPayment> {
    return this.payments.cancel(paymentId, customerId);
  }
}
