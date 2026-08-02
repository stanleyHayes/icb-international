import type { CustomerDoc } from '../../customers/infrastructure/customer.schemas.js';

/**
 * Reading the parts of a customer that KYC needs.
 *
 * The profile sub-documents are stored loosely typed, so every read goes through a guard here
 * rather than being asserted at a dozen call sites. A screening run against `"undefined
 * undefined"` would silently produce a clean result, which is exactly the kind of quiet failure
 * a compliance function cannot have.
 */

export type CustomerKind = 'individual' | 'business';

function readString(source: Record<string, unknown> | null, key: string): string {
  const value = source?.[key];
  return typeof value === 'string' ? value.trim() : '';
}

export function customerKind(customer: CustomerDoc): CustomerKind {
  return customer.type === 'business' ? 'business' : 'individual';
}

/** The name that is screened and shown in the review queue. */
export function customerDisplayName(customer: CustomerDoc): string {
  if (customerKind(customer) === 'business') {
    return readString(customer.business, 'legalName') || customer.email;
  }

  const parts = [
    readString(customer.individual, 'firstName'),
    readString(customer.individual, 'middleName'),
    readString(customer.individual, 'lastName'),
  ].filter((part) => part.length > 0);

  return parts.length > 0 ? parts.join(' ') : customer.email;
}
