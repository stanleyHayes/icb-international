import {
  annotateTransactionRequestSchema,
  cashflowSchema,
  exportTransactionsRequestSchema,
  isoDateSchema,
  spendByCategorySchema,
  transactionQuerySchema,
  type Cashflow,
  type CursorPage,
  type DownloadLink,
  type SpendByCategory,
  type TransactionDetail,
  type TransactionSummary,
} from '@icb/contracts';
import { Body, Controller, Get, Inject, Param, Patch, Post, Query, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';

import { CurrentCustomer } from '../../common/decorators/current-user.decorator.js';
import { Idempotent } from '../../common/decorators/idempotent.decorator.js';
import { CONFIG, type AppConfiguration } from '../../config/configuration.js';
import { ZodValidationPipe, zodBody } from '../../common/pipes/zod-validation.pipe.js';
import { ClockService } from '../../simulation/clock/clock.service.js';
import { TransactionAnalyticsService } from './analytics.service.js';
import { renderReceiptHtml } from './domain/receipt-html.js';
import { TransactionExportsService } from './exports.service.js';
import { TransactionsService } from './transactions.service.js';

/** Analytics query shapes, mirroring the SDK's client-side definitions of the same routes. */
const spendQuerySchema = spendByCategorySchema.pick({ currency: true }).extend({
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
});
const cashflowQuerySchema = cashflowSchema.pick({ currency: true, granularity: true });

const HTML_CONTENT_TYPE = 'text/html; charset=utf-8';

@Controller('transactions')
export class TransactionsController {
  constructor(
    private readonly transactions: TransactionsService,
    private readonly analytics: TransactionAnalyticsService,
    private readonly exports: TransactionExportsService,
    private readonly clock: ClockService,
    @Inject(CONFIG) private readonly config: AppConfiguration,
  ) {}

  @Get()
  async list(
    @CurrentCustomer() customerId: string,
    @Query(new ZodValidationPipe(transactionQuerySchema))
    query: ReturnType<typeof transactionQuerySchema.parse>,
  ): Promise<CursorPage<TransactionSummary>> {
    return this.transactions.list(customerId, query);
  }

  @Get('analytics/spend-by-category')
  async spendByCategory(
    @CurrentCustomer() customerId: string,
    @Query(new ZodValidationPipe(spendQuerySchema))
    query: ReturnType<typeof spendQuerySchema.parse>,
  ): Promise<SpendByCategory> {
    return this.analytics.spendByCategory(customerId, query);
  }

  @Get('analytics/cashflow')
  async cashflow(
    @CurrentCustomer() customerId: string,
    @Query(new ZodValidationPipe(cashflowQuerySchema))
    query: ReturnType<typeof cashflowQuerySchema.parse>,
  ): Promise<Cashflow> {
    return this.analytics.cashflow(customerId, query);
  }

  /**
   * Requests an export and answers with a short-lived download link. The service dedupes on
   * (account, format, window), so a retry returns the same export; `@Idempotent()` arms the
   * replay interceptor the moment the shared store (BE-03) is bound.
   */
  @Post('exports')
  @Idempotent()
  async requestExport(
    @CurrentCustomer() customerId: string,
    @Body(zodBody(exportTransactionsRequestSchema))
    body: ReturnType<typeof exportTransactionsRequestSchema.parse>,
  ): Promise<DownloadLink> {
    return this.exports.request(customerId, body);
  }

  /** Streams the rendered export bytes. The link already names its format and expiry. */
  @Get('exports/:exportId/download')
  async downloadExport(
    @CurrentCustomer() customerId: string,
    @Param('exportId') exportId: string,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const rendered = await this.exports.renderDownload(customerId, exportId);
    await reply
      .header('content-type', rendered.contentType)
      .header('content-disposition', `attachment; filename="${rendered.filename}"`)
      .send(rendered.bytes);
  }

  @Get(':transactionId')
  async detail(
    @CurrentCustomer() customerId: string,
    @Param('transactionId') transactionId: string,
  ): Promise<TransactionDetail> {
    return this.transactions.detail(customerId, transactionId);
  }

  @Patch(':transactionId')
  async annotate(
    @CurrentCustomer() customerId: string,
    @Param('transactionId') transactionId: string,
    @Body(zodBody(annotateTransactionRequestSchema))
    body: ReturnType<typeof annotateTransactionRequestSchema.parse>,
  ): Promise<TransactionDetail> {
    return this.transactions.annotate(customerId, transactionId, body);
  }

  /** A printable, self-contained HTML receipt for one transaction. */
  @Get(':transactionId/receipt')
  async receipt(
    @CurrentCustomer() customerId: string,
    @Param('transactionId') transactionId: string,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const detail = await this.transactions.detail(customerId, transactionId);
    const html = renderReceiptHtml({
      bankName: this.config.bank.name,
      detail,
      generatedAt: this.clock.now(),
    });
    await reply.header('content-type', HTML_CONTENT_TYPE).send(html);
  }
}
