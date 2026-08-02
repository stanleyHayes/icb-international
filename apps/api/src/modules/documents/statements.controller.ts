import {
  generateStatementRequestSchema,
  type DownloadLink,
  type GenerateStatementRequest,
  type Statement,
} from '@icb/contracts';
import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import { CurrentCustomer } from '../../common/decorators/current-user.decorator.js';
import { zodBody } from '../../common/pipes/zod-validation.pipe.js';
import { StatementsService } from './statements.service.js';

@Controller('statements')
export class StatementsController {
  constructor(private readonly statements: StatementsService) {}

  @Get()
  async list(@CurrentCustomer() customerId: string): Promise<{ items: Statement[] }> {
    return { items: await this.statements.listForCustomer(customerId) };
  }

  /**
   * Generates a statement for an arbitrary window. The account id in the body is only ever a
   * *filter*: the query that loads it is scoped to the authenticated customer, so naming
   * someone else's account returns a 404 rather than their transactions.
   */
  @Post('generate')
  async generate(
    @CurrentCustomer() customerId: string,
    @Body(zodBody(generateStatementRequestSchema)) body: GenerateStatementRequest,
  ): Promise<Statement> {
    return this.statements.generate(customerId, body);
  }

  /** A fresh signed link on every call; the previous one expires on its own. */
  @Get(':statementId/download')
  async download(
    @CurrentCustomer() customerId: string,
    @Param('statementId') statementId: string,
  ): Promise<DownloadLink> {
    return this.statements.downloadLink(customerId, statementId);
  }
}
