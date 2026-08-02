import type {
  AccountDetail,
  DownloadLink,
  GenerateStatementRequest,
  Statement,
} from '@icb/contracts';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { ConflictError, NotFoundError } from '../../common/errors/index.js';
import { newId } from '../../infrastructure/database/identifier.js';
import { isDuplicateKeyError } from '../../infrastructure/database/mongo-errors.js';
import { ClockService } from '../../simulation/clock/clock.service.js';
import { AccountsService } from '../accounts/accounts.service.js';
import { customerRef } from '../ledger/domain/account-ref.js';
import { DocumentArchiveService } from './document-archive.service.js';
import { accountLabelFor, statementFilename } from './domain/document-text.js';
import { buildStatementFigures, type StatementFigures } from './domain/statement-figures.js';
import { renderStatementPdf } from './domain/statement-pdf.js';
import {
  monthPeriod,
  resolvePeriod,
  withRunningBalances,
  type StatementLine,
  type StatementPeriod,
} from './domain/statement-period.js';
import { CustomerProfileReader } from './infrastructure/customer-profile.reader.js';
import { toStatement } from './infrastructure/document.mapper.js';
import { StatementDoc } from './infrastructure/document.schemas.js';
import { StatementLedgerReader } from './infrastructure/statement-ledger.reader.js';

/** The figures and the table, computed together so the running balance matches the totals. */
interface StatementDraft {
  figures: StatementFigures;
  lines: StatementLine[];
}

/** Everything the rendered PDF and the stored row need, resolved once. */
interface IssueContext {
  customerId: string;
  account: AccountDetail;
  period: StatementPeriod;
  accountLabel: string;
  holderName: string;
  generatedAt: Date;
}

const MEDIA_FOLDER = 'statements';

/**
 * Statement generation.
 *
 * A statement is derived entirely from `ledger_entries` — there is no parallel statement ledger
 * to drift out of step — reconciled before it is issued, rendered to a PDF, uploaded through the
 * asset store, and then recorded with the figures it was issued with. Requesting the same window
 * twice returns the statement already issued rather than a second render, so the customer and the
 * bank are always looking at the same document.
 */
@Injectable()
export class StatementsService {
  private readonly logger = new Logger(StatementsService.name);

  constructor(
    @InjectModel(StatementDoc.name) private readonly statements: Model<StatementDoc>,
    private readonly ledger: StatementLedgerReader,
    private readonly accounts: AccountsService,
    private readonly archive: DocumentArchiveService,
    private readonly profiles: CustomerProfileReader,
    private readonly clock: ClockService,
  ) {}

  async listForCustomer(customerId: string): Promise<Statement[]> {
    const issued = await this.statements
      .find({ customerId })
      .sort({ generatedAt: -1, _id: -1 })
      .lean();
    return issued.map(toStatement);
  }

  /** An ad-hoc window. Ownership comes from the token, never from the request body. */
  async generate(customerId: string, request: GenerateStatementRequest): Promise<Statement> {
    const period = resolvePeriod(request.from, request.to, this.clock.today());
    return this.issue(customerId, request.accountId, period);
  }

  /** The calendar month containing `date` — the regular month-end statement. */
  async generateForMonth(customerId: string, accountId: string, date: string): Promise<Statement> {
    const month = monthPeriod(date);
    return this.issue(customerId, accountId, resolvePeriod(month.from, month.to, this.clock.today()));
  }

  async downloadLink(customerId: string, statementId: string): Promise<DownloadLink> {
    const statement = await this.statements.findOne({ _id: statementId, customerId }).lean();
    if (!statement) {
      throw new NotFoundError('Statement', statementId);
    }
    if (!statement.asset) {
      throw new ConflictError('This statement has no rendered document', { statementId });
    }
    return this.archive.downloadLink(
      statement.asset,
      statementFilename(statement.accountLabel, statement.period),
    );
  }

  private async issue(
    customerId: string,
    accountId: string,
    period: StatementPeriod,
  ): Promise<Statement> {
    const existing = await this.statements
      .findOne({ customerId, accountId, from: period.from, to: period.to })
      .lean();
    if (existing) {
      return toStatement(existing);
    }

    const account = await this.accounts.getForCustomer(accountId, customerId);
    const profile = await this.profiles.require(customerId);
    const draft = await this.draft(account, period);

    return toStatement(
      await this.publish(
        {
          customerId,
          account,
          period,
          accountLabel: accountLabelFor(account.productName, account.identifiers.number),
          holderName: profile.displayName,
          generatedAt: this.clock.now(),
        },
        draft,
      ),
    );
  }

  /**
   * Reads the two windows the statement needs and reconciles them. `buildStatementFigures`
   * throws rather than returning figures that do not add up, so nothing downstream re-checks
   * the arithmetic.
   */
  private async draft(account: AccountDetail, period: StatementPeriod): Promise<StatementDraft> {
    const accountRef = customerRef(account.id);
    const { currency } = account;

    const [normalSide, before, within] = await Promise.all([
      this.ledger.normalSideFor(accountRef, currency),
      this.ledger.totalsBefore(accountRef, currency, period.from),
      this.ledger.totalsWithin(accountRef, currency, period.from, period.to),
    ]);

    const figures = buildStatementFigures(before, within, normalSide, {
      accountId: account.id,
      from: period.from,
      to: period.to,
      currency,
    });

    const rows = await this.ledger.linesWithin(accountRef, currency, period.from, period.to);
    return { figures, lines: withRunningBalances(rows, figures.openingMinorUnits) };
  }

  /**
   * Render, upload, record — in that order, so a statement never points at nothing.
   *
   * Two requests for the same window can race here: both render, and the unique index on
   * (account, from, to) rejects the second write. The loser deletes the asset it had just
   * uploaded and returns the statement that won, so the race costs an upload rather than
   * leaving an orphaned PDF in the bucket or handing the customer a second document.
   */
  private async publish(context: IssueContext, draft: StatementDraft): Promise<StatementDoc> {
    const { account, period } = context;
    const document = await this.archive.store({
      customerId: context.customerId,
      kind: 'statement',
      title: `Statement ${period.period} for account ${account.identifiers.number}`,
      accountId: account.id,
      ownerId: account.id,
      folder: MEDIA_FOLDER,
      filename: statementFilename(account.identifiers.number, period.period),
      bytes: this.render(context, draft),
    });

    try {
      const recorded = await this.record(context, draft.figures, document._id, document.asset);
      this.logger.log(
        { accountId: account.id, period: period.period, documentId: document._id },
        'Statement issued',
      );
      return recorded;
    } catch (error) {
      if (!isDuplicateKeyError(error)) {
        throw error;
      }
      await this.archive.discard(document);
      return this.requireIssued(context);
    }
  }

  private render(context: IssueContext, draft: StatementDraft): Buffer {
    return renderStatementPdf({
      branding: this.archive.branding,
      accountLabel: context.accountLabel,
      identifiers: context.account.identifiers,
      holderName: context.holderName,
      period: context.period,
      currency: context.account.currency,
      figures: draft.figures,
      lines: draft.lines,
      generatedAt: context.generatedAt,
    });
  }

  /** The statement that won the race. Its absence would mean the index rejected us wrongly. */
  private async requireIssued(context: IssueContext): Promise<StatementDoc> {
    const issued = await this.statements
      .findOne({
        customerId: context.customerId,
        accountId: context.account.id,
        from: context.period.from,
        to: context.period.to,
      })
      .lean();

    if (!issued) {
      throw new ConflictError('The statement could not be recorded', {
        accountId: context.account.id,
      });
    }
    return issued;
  }

  private async record(
    context: IssueContext,
    figures: StatementFigures,
    documentId: string,
    asset: StatementDoc['asset'],
  ): Promise<StatementDoc> {
    const [created] = await this.statements.create([
      {
        _id: newId(),
        customerId: context.customerId,
        accountId: context.account.id,
        accountLabel: context.accountLabel,
        period: context.period.period,
        from: context.period.from,
        to: context.period.to,
        currency: context.account.currency,
        openingMinorUnits: figures.openingMinorUnits,
        closingMinorUnits: figures.closingMinorUnits,
        totalCreditsMinorUnits: figures.totalCreditsMinorUnits,
        totalDebitsMinorUnits: figures.totalDebitsMinorUnits,
        transactionCount: figures.transactionCount,
        asset,
        documentId,
        generatedAt: context.generatedAt,
      },
    ]);

    if (!created) {
      throw new ConflictError('The statement could not be recorded', {
        accountId: context.account.id,
      });
    }
    return created;
  }
}
