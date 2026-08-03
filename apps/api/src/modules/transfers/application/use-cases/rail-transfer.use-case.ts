import type { TransferRail } from '@icb/contracts';
import type { ClientSession } from 'mongoose';

import type { TransferExecution, PreparedTransfer } from '../transfer-pipeline.types.js';

/** Injection token for the rail use-case set — one entry per rail. */
export const RAIL_USE_CASES = Symbol('ICB_RAIL_USE_CASES');

/**
 * One use-case per rail.
 *
 * The orchestrator runs the common pipeline — validate, limits, beneficiary check, fraud score,
 * FX, fees — and hands the result here. A use-case owns exactly one decision: where the credit
 * leg lands and when the value settles. Everything else would be a second copy of the pipeline.
 */
export interface RailTransferUseCase {
  readonly rail: TransferRail;
  execute(prepared: PreparedTransfer, session: ClientSession): Promise<TransferExecution>;

  /**
   * Customer balance documents this rail will write, beyond the sender's own.
   *
   * The orchestrator asks *before* opening the transaction, so postings that share an account
   * queue instead of colliding — see KeyedMutex. Only customer accounts are declared: GL
   * contention is broad but brief, and the transaction retry loop absorbs it without
   * serialising every transfer in the bank behind one shared control account.
   */
  contendedKeys?(prepared: PreparedTransfer): Promise<string[]>;
}
