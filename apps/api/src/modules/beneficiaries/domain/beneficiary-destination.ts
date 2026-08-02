import type { TransferDestination } from '@icb/contracts';

/**
 * How a destination is addressed, masked, and de-duplicated.
 *
 * Dedupe happens on the *identifier*, never on the nickname: a customer who saves "Mum" and
 * "Mum (new phone)" against the same account has one payee, and treating them as two quietly
 * hands the fraud controls a fresh cooling-off window each time.
 */

/** The value that uniquely addresses a destination, whichever shape the union takes. */
export function destinationIdentifier(destination: TransferDestination): string {
  switch (destination.kind) {
    case 'own_account':
      return destination.accountId;
    case 'icb_customer':
      return destination.accountNumber;
    case 'domestic_bank':
      return `${destination.sortCode}${destination.accountNumber}`;
    case 'international':
      return destination.iban;
    case 'beneficiary':
      return destination.beneficiaryId;
  }
}

/**
 * The dedupe key. Case and separators are normalised because an IBAN typed with spaces is the
 * same IBAN, and a customer should not be able to create a second record by typing it differently.
 */
export function destinationKey(destination: TransferDestination): string {
  const identifier = destinationIdentifier(destination)
    .replaceAll(/[\s-]/g, '')
    .toUpperCase();
  return `${destination.kind}:${identifier}`;
}

/** Never echo a full destination identifier back to a client. */
export function maskIdentifier(value: string): string {
  return value.length <= 4 ? value : `•••• ${value.slice(-4)}`;
}

/** The name the counterparty supplied on the destination itself, when the shape carries one. */
export function destinationHolderName(destination: TransferDestination): string | null {
  return 'accountHolderName' in destination ? destination.accountHolderName : null;
}

/** True when the destination points at an account ICB itself holds. */
export function isInternalDestination(destination: TransferDestination): boolean {
  return destination.kind === 'own_account' || destination.kind === 'icb_customer';
}
