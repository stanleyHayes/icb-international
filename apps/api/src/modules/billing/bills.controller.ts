import {
  configureAutopayRequestSchema,
  linkBillRequestSchema,
  payBillRequestSchema,
  type BillPayment,
  type LinkedBill,
} from '@icb/contracts';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';

import { CurrentCustomer } from '../../common/decorators/current-user.decorator.js';
import { zodBody } from '../../common/pipes/zod-validation.pipe.js';
import { BillPaymentsService } from './bill-payments.service.js';
import { BillsService } from './bills.service.js';

/**
 * Bills a customer has linked.
 *
 * Every handler takes the customer from the verified token, never from the path or body — the
 * bill id in the URL is a *filter*, not an authorisation.
 */
@Controller('bills')
export class BillsController {
  constructor(
    private readonly bills: BillsService,
    private readonly payments: BillPaymentsService,
  ) {}

  @Get()
  async list(@CurrentCustomer() customerId: string): Promise<{ items: LinkedBill[] }> {
    return { items: await this.bills.listForCustomer(customerId) };
  }

  @Post()
  async link(
    @CurrentCustomer() customerId: string,
    @Body(zodBody(linkBillRequestSchema)) body: ReturnType<typeof linkBillRequestSchema.parse>,
  ): Promise<LinkedBill> {
    return this.bills.link(customerId, body);
  }

  @Get(':billId')
  async detail(
    @CurrentCustomer() customerId: string,
    @Param('billId') billId: string,
  ): Promise<LinkedBill> {
    return this.bills.getForCustomer(billId, customerId);
  }

  @Delete(':billId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unlink(
    @CurrentCustomer() customerId: string,
    @Param('billId') billId: string,
  ): Promise<void> {
    await this.bills.unlink(billId, customerId);
  }

  @Patch(':billId/autopay')
  async configureAutopay(
    @CurrentCustomer() customerId: string,
    @Param('billId') billId: string,
    @Body(zodBody(configureAutopayRequestSchema))
    body: ReturnType<typeof configureAutopayRequestSchema.parse>,
  ): Promise<LinkedBill> {
    return this.bills.configureAutopay(billId, customerId, body);
  }

  @Post(':billId/pay')
  async pay(
    @CurrentCustomer() customerId: string,
    @Param('billId') billId: string,
    @Body(zodBody(payBillRequestSchema)) body: ReturnType<typeof payBillRequestSchema.parse>,
  ): Promise<BillPayment> {
    return this.payments.pay(customerId, billId, body);
  }
}
