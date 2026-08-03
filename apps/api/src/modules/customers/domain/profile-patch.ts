import type { CustomerType, UpdateProfileRequest } from '@icb/contracts';

import { ValidationError } from '../../../common/errors/index.js';
import type { UpdatePreferencesRequest } from '../customers.types.js';

/**
 * Turns a validated profile update into a Mongo `$set` patch.
 *
 * Sub-documents are flattened to dotted paths (`individual.firstName`) so a partial update
 * cannot clobber the fields it does not mention — replacing the whole sub-document would
 * erase `lastName` whenever someone changes their employer.
 *
 * The type guard is the second thing worth noticing: a business customer has no `individual`
 * block and an individual has no `business` one. Accepting the wrong block would store data
 * the KYC screening reads as absent, so it is rejected at the boundary.
 */
export function buildProfilePatch(
  request: UpdateProfileRequest,
  customerType: CustomerType,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (request.phone !== undefined) {
    patch['phone'] = request.phone;
  }
  if (request.residentialAddress !== undefined) {
    patch['residentialAddress'] = request.residentialAddress;
  }
  if (request.postalAddress !== undefined) {
    patch['postalAddress'] = request.postalAddress;
  }
  return {
    ...patch,
    ...flattenSubProfile('individual', request.individual, customerType),
    ...flattenSubProfile('business', request.business, customerType),
  };
}

/** Preferences live in one sub-document; the same dotted-path rule applies. */
export function buildPreferencesPatch(
  request: UpdatePreferencesRequest,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(request)) {
    if (value !== undefined) {
      patch[`preferences.${key}`] = value;
    }
  }
  return patch;
}

function flattenSubProfile(
  kind: CustomerType,
  value: Record<string, unknown> | undefined,
  customerType: CustomerType,
): Record<string, unknown> {
  if (value === undefined) {
    return {};
  }
  if (customerType !== kind) {
    throw new ValidationError(`A ${customerType} customer has no ${kind} details`, [
      { path: kind, message: `Only a ${kind} customer can update ${kind} details` },
    ]);
  }
  const patch: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry !== undefined) {
      patch[`${kind}.${key}`] = entry;
    }
  }
  return patch;
}
