import { DISPUTE_STAGES, type DisputeOutcome, type DisputeStage } from '@icb/contracts';
import { describe, expect, it } from 'vitest';

import {
  INITIAL_STAGE,
  TERMINAL_STAGE,
  allowedNextStages,
  canAdvance,
  grantsCreditOnResolution,
  isInCustomerFavour,
  isTerminal,
} from '../../risk/domain/dispute-stages.js';

/**
 * The full transition matrix of the dispute stage machine (implementation lives in the risk
 * module; these tests pin it). Every legal move is asserted, and every illegal one — including
 * backwards moves, self-loops and anything out of `resolved` — is asserted to be refused.
 */
const LEGAL_MOVES: Readonly<Record<DisputeStage, readonly DisputeStage[]>> = {
  submitted: ['investigating', 'resolved'],
  investigating: ['provisional_credit', 'representment', 'resolved'],
  provisional_credit: ['representment', 'resolved'],
  representment: ['arbitration', 'resolved'],
  arbitration: ['resolved'],
  resolved: [],
};

describe('dispute stage machine', () => {
  it('declares submitted as the initial stage and resolved as terminal', () => {
    expect(INITIAL_STAGE).toBe('submitted');
    expect(TERMINAL_STAGE).toBe('resolved');
    expect(isTerminal('resolved')).toBe(true);
    expect(isTerminal('arbitration')).toBe(false);
  });

  it('covers every stage in the contract enum', () => {
    expect(Object.keys(LEGAL_MOVES).sort((a, b) => a.localeCompare(b))).toEqual(
      [...DISPUTE_STAGES].sort((a, b) => a.localeCompare(b)),
    );
  });

  it.each(DISPUTE_STAGES)('allows exactly the legal moves out of %s', (from) => {
    expect(allowedNextStages(from)).toEqual(LEGAL_MOVES[from]);
    for (const to of DISPUTE_STAGES) {
      expect(canAdvance(from, to), `${from} -> ${to}`).toBe(LEGAL_MOVES[from].includes(to));
    }
  });

  it('refuses every move out of the terminal stage', () => {
    for (const to of DISPUTE_STAGES) {
      expect(canAdvance('resolved', to)).toBe(false);
    }
  });

  it('refuses the linear happy path taken out of order', () => {
    expect(canAdvance('submitted', 'provisional_credit')).toBe(false);
    expect(canAdvance('submitted', 'representment')).toBe(false);
    expect(canAdvance('submitted', 'arbitration')).toBe(false);
    expect(canAdvance('investigating', 'arbitration')).toBe(false);
    expect(canAdvance('provisional_credit', 'arbitration')).toBe(false);
  });

  it('refuses backwards moves and self-loops', () => {
    const backwards: ReadonlyArray<readonly [DisputeStage, DisputeStage]> = [
      ['investigating', 'submitted'],
      ['provisional_credit', 'investigating'],
      ['representment', 'provisional_credit'],
      ['arbitration', 'representment'],
      ['arbitration', 'arbitration'],
      ['submitted', 'submitted'],
    ];
    for (const [from, to] of backwards) {
      expect(canAdvance(from, to)).toBe(false);
    }
  });
});

describe('outcome mapping', () => {
  it.each([
    ['upheld', true],
    ['partial', true],
    ['rejected', false],
    ['withdrawn', false],
  ] as ReadonlyArray<readonly [DisputeOutcome, boolean]>)(
    '%s in customer favour: %s',
    (outcome, expected) => {
      expect(isInCustomerFavour(outcome)).toBe(expected);
    },
  );

  it('only a full upholding creates credit that was never granted', () => {
    expect(grantsCreditOnResolution('upheld')).toBe(true);
    expect(grantsCreditOnResolution('partial')).toBe(false);
    expect(grantsCreditOnResolution('rejected')).toBe(false);
    expect(grantsCreditOnResolution('withdrawn')).toBe(false);
  });
});
