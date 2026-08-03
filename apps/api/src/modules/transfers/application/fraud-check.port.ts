import type { RiskDecision } from '@icb/contracts';
import type { CurrencyCode } from '@icb/money';

/** Injection token — the pipeline binds whichever fraud engine the deployment provides. */
export const FRAUD_CHECK_PORT = Symbol('ICB_FRAUD_CHECK_PORT');

export interface FraudCheckInput {
  readonly customerId: string;
  /** The transfer's id, used as the assessment's subject so the audit trail joins up. */
  readonly subjectId: string;
  readonly amountMinorUnits: number;
  readonly currency: CurrencyCode;
  /** Signals the caller observed: the payee being paid and where the money is going. */
  readonly beneficiaryId?: string | null;
  readonly countryCode?: string | null;
}

export interface FraudCheckOutcome {
  readonly decision: RiskDecision;
  /** The stored assessment, when the engine records one; null for the allow-all stub. */
  readonly assessmentId: string | null;
}

/**
 * The fraud-scoring seam.
 *
 * The orchestrator talks to this port, never to the risk module directly, so a deployment
 * without the risk engine can bind the allow-all stub and the pipeline shape stays identical.
 */
export interface FraudCheckPort {
  check(input: FraudCheckInput): Promise<FraudCheckOutcome>;
}

/** Default-allow stub: scores nothing, blocks nothing, records nothing. */
export class AllowAllFraudCheck implements FraudCheckPort {
  check(): Promise<FraudCheckOutcome> {
    return Promise.resolve({ decision: 'allow', assessmentId: null });
  }
}
