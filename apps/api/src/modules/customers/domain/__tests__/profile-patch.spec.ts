import { describe, expect, it } from 'vitest';

import { ValidationError } from '../../../../common/errors/index.js';
import { buildPreferencesPatch, buildProfilePatch } from '../profile-patch.js';

const ADDRESS = {
  line1: '1 High Street',
  city: 'Accra',
  country: 'GH',
} as const;

describe('buildProfilePatch', () => {
  it('maps top-level fields directly', () => {
    const patch = buildProfilePatch(
      { phone: '+233200000000', residentialAddress: ADDRESS },
      'individual',
    );
    expect(patch).toEqual({ phone: '+233200000000', residentialAddress: ADDRESS });
  });

  it('preserves an explicit null postal address as a clear, not an omission', () => {
    const patch = buildProfilePatch({ postalAddress: null }, 'individual');
    expect(patch).toEqual({ postalAddress: null });
  });

  it('flattens sub-profiles to dotted paths so partial updates cannot clobber siblings', () => {
    const patch = buildProfilePatch(
      { individual: { employer: 'ICB', occupation: 'Engineer' } },
      'individual',
    );
    expect(patch).toEqual({ 'individual.employer': 'ICB', 'individual.occupation': 'Engineer' });
  });

  it('accepts business details on a business customer', () => {
    const patch = buildProfilePatch({ business: { industry: 'Retail' } }, 'business');
    expect(patch).toEqual({ 'business.industry': 'Retail' });
  });

  it('rejects individual details on a business customer', () => {
    expect(() =>
      buildProfilePatch({ individual: { firstName: 'Ama' } }, 'business'),
    ).toThrow(ValidationError);
  });

  it('rejects business details on an individual customer', () => {
    expect(() => buildProfilePatch({ business: { industry: 'Tech' } }, 'individual')).toThrow(
      ValidationError,
    );
  });

  it('returns an empty patch for an empty request', () => {
    expect(buildProfilePatch({}, 'individual')).toEqual({});
  });
});

describe('buildPreferencesPatch', () => {
  it('flattens preferences under the sub-document', () => {
    const patch = buildPreferencesPatch({ marketingEmail: true, statementDelivery: 'email' });
    expect(patch).toEqual({
      'preferences.marketingEmail': true,
      'preferences.statementDelivery': 'email',
    });
  });

  it('returns an empty patch when nothing changes', () => {
    expect(buildPreferencesPatch({})).toEqual({});
  });
});
