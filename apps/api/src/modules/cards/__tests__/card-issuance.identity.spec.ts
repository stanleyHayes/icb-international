import { beforeEach, describe, expect, it } from 'vitest';

import { ConflictError } from '../../../common/errors/index.js';
import { isLuhnValid } from '../domain/card-numbers.js';
import { decryptField, fingerprint } from '../domain/pan-cipher.js';
import { CUSTOMER_ID } from './fixtures.js';
import {
  type IssuanceDeps,
  createdPayload,
  issuanceSetup,
  issueRequest,
} from './card-issuance.service.spec.js';

const FIELD_KEY = 'a'.repeat(64);

describe('CardIssuanceService PAN allocation', () => {
  let deps: IssuanceDeps;

  beforeEach(() => {
    deps = issuanceSetup();
  });

  it('stores the PAN sealed with a matching fingerprint and last4, never in the clear', async () => {
    await deps.service.issue(CUSTOMER_ID, issueRequest());

    const payload = createdPayload(deps.cards);
    const pan = decryptField(payload['panEncrypted'] as string, FIELD_KEY);
    expect(pan.startsWith('424212')).toBe(true);
    expect(isLuhnValid(pan)).toBe(true);
    expect(payload['panLast4']).toBe(pan.slice(-4));
    expect(payload['panFingerprint']).toBe(fingerprint(pan, FIELD_KEY));
    expect(JSON.stringify(payload)).not.toContain(pan);
  });

  it('generates mastercard PANs on the mastercard BIN', async () => {
    await deps.service.issue(CUSTOMER_ID, issueRequest({ network: 'mastercard' }));

    const payload = createdPayload(deps.cards);
    const pan = decryptField(payload['panEncrypted'] as string, FIELD_KEY);
    expect(pan.startsWith('535312')).toBe(true);
    expect(isLuhnValid(pan)).toBe(true);
  });

  it('retries when a generated PAN collides with a live card', async () => {
    deps.cards.exists.mockResolvedValueOnce({ _id: 'other-card' }).mockResolvedValue(null);

    await deps.service.issue(CUSTOMER_ID, issueRequest());

    expect(deps.cards.exists).toHaveBeenCalledTimes(2);
    expect(deps.cards.create).toHaveBeenCalledTimes(1);
  });

  it('gives up with a conflict after five colliding allocations', async () => {
    deps.cards.exists.mockResolvedValue({ _id: 'other-card' });

    await expect(deps.service.issue(CUSTOMER_ID, issueRequest())).rejects.toThrow(ConflictError);
    expect(deps.cards.exists).toHaveBeenCalledTimes(5);
    expect(deps.cards.create).not.toHaveBeenCalled();
  });
});

describe('CardIssuanceService cardholder name', () => {
  it('embosses the uppercased individual name', async () => {
    const deps = issuanceSetup({ individual: { firstName: 'Ama', lastName: 'Mensah' }, business: null });

    await deps.service.issue(CUSTOMER_ID, issueRequest());

    expect(createdPayload(deps.cards)).toEqual(
      expect.objectContaining({ cardholderName: 'AMA MENSAH' }),
    );
  });

  it('prefers the business legal name for a business customer', async () => {
    const deps = issuanceSetup({
      individual: { firstName: 'Ama', lastName: 'Mensah' },
      business: { legalName: 'Acme Ltd' },
    });

    await deps.service.issue(CUSTOMER_ID, issueRequest());

    expect(createdPayload(deps.cards)).toEqual(
      expect.objectContaining({ cardholderName: 'ACME LTD' }),
    );
  });

  it('embosses whichever name parts exist', async () => {
    const deps = issuanceSetup({ individual: { firstName: 'Ama' }, business: null });

    await deps.service.issue(CUSTOMER_ID, issueRequest());

    expect(createdPayload(deps.cards)).toEqual(expect.objectContaining({ cardholderName: 'AMA' }));
  });

  it('falls back to the bank name when the customer record is missing', async () => {
    const deps = issuanceSetup(null);

    await deps.service.issue(CUSTOMER_ID, issueRequest());

    expect(createdPayload(deps.cards)).toEqual(
      expect.objectContaining({ cardholderName: 'IMPERIAL COMMERCE BANK' }),
    );
  });

  it('falls back to the bank name when the customer has no name at all', async () => {
    const deps = issuanceSetup({ individual: null, business: null });

    await deps.service.issue(CUSTOMER_ID, issueRequest());

    expect(createdPayload(deps.cards)).toEqual(
      expect.objectContaining({ cardholderName: 'IMPERIAL COMMERCE BANK' }),
    );
  });
});
