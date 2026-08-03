import type {
  BulkTransferRequest,
  BulkTransferResult,
  CreateTransferRequest,
} from '@icb/contracts';
import { Injectable, Logger } from '@nestjs/common';

import { isDomainError } from '../../../common/errors/index.js';
import { newId } from '../../../infrastructure/database/identifier.js';
import { toMoneyDto } from '../../accounts/infrastructure/account.mapper.js';
import { parseBulkTransferCsv } from '../domain/bulk-csv.js';
import { TransferOrchestrator } from './transfer-orchestrator.js';

interface RowFailure {
  readonly rowNumber: number;
  readonly code: string;
  readonly message: string;
}

/**
 * Bulk payments.
 *
 * Rows are validated as a batch before anything executes — the schema does the structural half,
 * the CSV parser the text half — then each accepted row runs through the same orchestrator a
 * single payment would. A row that fails does not stop the batch: it is reported with its row
 * number and the rest proceed, which is how a payroll file with one bad account number behaves
 * at a real bank.
 */
@Injectable()
export class BulkTransfersService {
  private readonly logger = new Logger(BulkTransfersService.name);

  constructor(private readonly orchestrator: TransferOrchestrator) {}

  async execute(customerId: string, request: BulkTransferRequest): Promise<BulkTransferResult> {
    const failures: RowFailure[] = [];
    let accepted = 0;
    let totalDebitMinorUnits = 0;
    let currency: string | null = null;

    for (const row of request.rows) {
      try {
        const doc = await this.orchestrator.initiate(customerId, this.toCreateRequest(request, row));
        accepted += 1;
        totalDebitMinorUnits += doc.debitMinorUnits ?? row.amount.minorUnits;
        currency = doc.currency ?? row.amount.currency;
      } catch (error) {
        failures.push(this.toFailure(row.rowNumber, error));
      }
    }

    this.logger.log(
      { accepted, rejected: failures.length, customerId },
      'Bulk transfer batch executed',
    );
    return {
      batchId: newId(),
      accepted,
      rejected: failures.length,
      totalDebit: toMoneyDto(totalDebitMinorUnits, currency ?? request.rows[0]?.amount.currency ?? 'GBP'),
      failures,
    };
  }

  /** CSV in, batch out — parsing is all-or-nothing before a single payment runs. */
  async executeCsv(
    customerId: string,
    fromAccountId: string,
    csv: string,
  ): Promise<BulkTransferResult> {
    const parsed = parseBulkTransferCsv(csv);
    return this.execute(customerId, { fromAccountId, rows: parsed.rows });
  }

  /** A bulk row is just a single send with the batch's shared source account. */
  private toCreateRequest(
    request: BulkTransferRequest,
    row: BulkTransferRequest['rows'][number],
  ): CreateTransferRequest {
    return {
      fromAccountId: request.fromAccountId,
      destination: row.destination,
      amount: row.amount,
      saveBeneficiary: false,
      ...(row.reference ? { reference: row.reference } : {}),
      ...(request.executeAt
        ? { schedule: { startsOn: request.executeAt.slice(0, 10) } }
        : {}),
    };
  }

  private toFailure(rowNumber: number, error: unknown): RowFailure {
    if (isDomainError(error)) {
      return { rowNumber, code: error.code, message: error.message };
    }
    return { rowNumber, code: 'INTERNAL_ERROR', message: 'The payment could not be made' };
  }
}
