/** Injection token — the pipeline binds whichever source of customer limits a deployment has. */
export const CUSTOMER_LIMITS_PORT = Symbol('ICB_CUSTOMER_LIMITS_PORT');

/**
 * The ceilings a single customer is held to, in minor units.
 *
 * Deliberately not `KycTierLimits`: the transfer pipeline cares that a customer has limits, not
 * that KYC is what decided them. `null` means "no ceiling of this kind".
 */
export interface CustomerLimits {
  /** The tier these came from, for the error a customer reads. */
  readonly label: string;
  readonly singleTransferMinorUnits: number | null;
  readonly dailyTransferMinorUnits: number | null;
  readonly monthlyTransferMinorUnits: number | null;
  readonly internationalAllowed: boolean;
}

/**
 * The customer-limits seam.
 *
 * Rail caps bound what the *bank* will move on a given rail; these bound what *this customer*
 * may move at all, and the two are enforced side by side — whichever is lower bites. Kept
 * behind a port so a deployment without the KYC module binds the unlimited stub and the
 * pipeline shape is unchanged, exactly as `FraudCheckPort` does for scoring.
 */
export interface CustomerLimitsPort {
  limitsFor(customerId: string): Promise<CustomerLimits>;
}

/** Default-open stub: every customer unbounded, every rail allowed. */
export class UnlimitedCustomerLimits implements CustomerLimitsPort {
  limitsFor(): Promise<CustomerLimits> {
    return Promise.resolve({
      label: 'unverified',
      singleTransferMinorUnits: null,
      dailyTransferMinorUnits: null,
      monthlyTransferMinorUnits: null,
      internationalAllowed: true,
    });
  }
}
