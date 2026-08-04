import type { Beneficiary, TransferRail } from '@icb/contracts';

/** Small presentation helpers for payees, shared by the list and detail screens. */

export function destinationKindLabel(beneficiary: Beneficiary): string {
  switch (beneficiary.destination.kind) {
    case 'icb_customer':
      return 'ICB customer';
    case 'domestic_bank':
      return beneficiary.bankName ?? 'Domestic bank';
    case 'international':
      return beneficiary.bankName ?? 'International';
    case 'own_account':
      return 'Own account';
    case 'beneficiary':
      return 'Payee';
  }
}

/** The rail a payment to this payee would take, used to deep-link the transfer wizard. */
export function railForBeneficiary(beneficiary: Beneficiary): TransferRail | null {
  switch (beneficiary.destination.kind) {
    case 'own_account':
      return 'internal';
    case 'icb_customer':
      return 'on_us';
    case 'domestic_bank':
      return 'ach';
    case 'international':
      return 'swift';
    case 'beneficiary':
      return null;
  }
}

/** True while the new-payee cooling-off window is still running. */
export function inCoolingOff(beneficiary: Beneficiary, now: Date = new Date()): boolean {
  return beneficiary.coolingOffUntil !== null && new Date(beneficiary.coolingOffUntil) > now;
}
