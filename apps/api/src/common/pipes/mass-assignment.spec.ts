import {
  updateAccountRequestSchema,
  updateCardControlsRequestSchema,
  updateProfileRequestSchema,
} from '@icb/contracts';
import { describe, expect, it } from 'vitest';

import { zodBody } from './zod-validation.pipe.js';

/**
 * Mass-assignment regression coverage for three representative PATCH bodies.
 *
 * The defense has two layers, and both are exercised here:
 *  1. the validation pipe strips every key the schema does not declare, so privileged fields
 *     (`status`, `balances`, `pan`, `tier`, …) never reach the service layer;
 *  2. the services then map the surviving fields through explicit allow-lists
 *     (`AccountProfileService`, `buildProfilePatch`, `CardSettingsService`) rather than
 *     spreading the request into a Mongo update — verified by the module specs.
 */
describe('mass assignment: privileged fields are stripped at the boundary', () => {
  it('accounts PATCH: status and balances cannot be smuggled in', () => {
    const pipe = zodBody(updateAccountRequestSchema);

    const parsed = pipe.transform({
      nickname: 'Holiday fund',
      status: 'frozen',
      balances: { available: { minorUnits: 9_999_999, currency: 'GBP' } },
      customerId: 'cust_other',
    });

    expect(parsed).toEqual({ nickname: 'Holiday fund' });
  });

  it('customers PATCH: type, status and tier cannot be smuggled in', () => {
    const pipe = zodBody(updateProfileRequestSchema);

    const parsed = pipe.transform({
      phone: '+447700900123',
      type: 'business',
      status: 'closed',
      tier: 'private',
      kycStatus: 'verified',
    });

    expect(parsed).toEqual({ phone: '+447700900123' });
  });

  it('cards controls PATCH: PAN, status and limits cannot be smuggled in', () => {
    const pipe = zodBody(updateCardControlsRequestSchema);
    // The channels record is exhaustive in the contract: every channel, every time.
    const channels = {
      online: false,
      contactless: true,
      atm: true,
      international: false,
      in_store: true,
    };

    const parsed = pipe.transform({
      channels,
      pan: '4242424242424242',
      status: 'cancelled',
      limits: { daily: { minorUnits: 1, currency: 'GBP' } },
    });

    expect(parsed).toEqual({ channels });
  });

  it('a body of *only* privileged fields parses to an empty patch — a no-op, not a write', () => {
    const pipe = zodBody(updateAccountRequestSchema);

    expect(pipe.transform({ status: 'frozen', primary: undefined })).toEqual({});
  });
});
