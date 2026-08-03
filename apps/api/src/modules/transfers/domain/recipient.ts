import type { TransferDestination } from '@icb/contracts';

/**
 * How a destination is described and masked back to the customer.
 *
 * A full IBAN or account number is never echoed in a read model — the last four are enough to
 * recognise the payee and not enough to reuse the identifier.
 */

/** The identifier a destination is addressed by, whichever shape it takes. */
export function describeDestination(destination: TransferDestination): string {
  switch (destination.kind) {
    case 'own_account':
      return destination.accountId;
    case 'icb_customer':
    case 'domestic_bank':
      return destination.accountNumber;
    case 'international':
      return destination.iban;
    case 'beneficiary':
      return destination.beneficiaryId;
  }
}

/** The name the receipt shows for the recipient. */
export function recipientNameFor(destination: TransferDestination): string {
  switch (destination.kind) {
    case 'domestic_bank':
    case 'international':
      return destination.accountHolderName;
    case 'own_account':
    case 'icb_customer':
    case 'beneficiary':
      return '';
  }
}

/** Never show a full destination identifier back to a customer. */
export function maskIdentifier(value: string): string {
  return value.length <= 4 ? value : `•••• ${value.slice(-4)}`;
}
