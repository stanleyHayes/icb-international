import type { RailProfile, SimulationRail } from '@icb/contracts';
import { fromMinorUnits } from '@icb/money';
import { beforeEach, describe, expect, it } from 'vitest';

import { ClockService } from '../../clock/clock.service.js';
import { createHelpers } from '../../seed/random.js';
import { AchRail } from '../ach.rail.js';
import { CardNetworkRail } from '../card-network.rail.js';
import { InternalRail } from '../internal.rail.js';
import { RailRegistry } from '../rail.registry.js';
import { RAIL_UNAVAILABLE } from '../rail-codes.js';
import type { RailSubmission } from '../rail.types.js';
import { SwiftRail } from '../swift.rail.js';
import { WireRail } from '../wire.rail.js';

/** A Wednesday, and not a holiday. Friday 7 August is the next banking day after it. */
const WEDNESDAY_1500 = new Date('2026-08-05T15:00:00.000Z');
const WEDNESDAY_1630 = new Date('2026-08-05T16:30:00.000Z');

const SUBMISSION: RailSubmission = {
  sourceId: '01J8ZC000000000000000000AA',
  amount: fromMinorUnits(125_000, 'USD'),
  debtorAccount: '4471096322',
  debtorName: 'A Customer',
  creditorName: 'ACME SUPPLIES LTD',
  creditorAccount: 'GB29ICBK60161331926819',
  narrative: 'Invoice 4471',
};

/** Rail profiles live in `sim_state`; the registry only needs read and write. */
function stubState(overrides: RailProfile[] = []) {
  const stored = new Map(overrides.map((profile) => [profile.rail, profile]));
  return {
    railProfiles: () => Promise.resolve([...stored.values()]),
    saveRailProfile: (profile: RailProfile) => {
      stored.set(profile.rail, profile);
      return Promise.resolve();
    },
  };
}

function buildRegistry(overrides: RailProfile[] = []): RailRegistry {
  const clock = new ClockService();
  clock.freeze(WEDNESDAY_1500);

  const adapters = [
    new InternalRail(),
    new AchRail(),
    new WireRail(),
    new SwiftRail(),
    new CardNetworkRail(),
  ];

  return new RailRegistry(
    adapters,
    stubState(overrides) as unknown as ConstructorParameters<typeof RailRegistry>[1],
    clock,
  );
}

function profileFor(registry: RailRegistry, rail: SimulationRail): RailProfile {
  const profile = registry.defaultProfiles().find((candidate) => candidate.rail === rail);
  if (!profile) {
    throw new Error(`No default profile for ${rail}`);
  }
  return profile;
}

describe('rail adapters', () => {
  let registry: RailRegistry;

  beforeEach(() => {
    registry = buildRegistry();
  });

  it('produces identical results from identical seeds', async () => {
    const first = await registry.dispatch('card', SUBMISSION, { random: createHelpers('demo') });
    const second = await registry.dispatch('card', SUBMISSION, { random: createHelpers('demo') });

    expect(first).toEqual(second);
  });

  it('produces different results from different seeds', async () => {
    const first = await registry.dispatch('swift', SUBMISSION, { random: createHelpers('a') });
    const second = await registry.dispatch('swift', SUBMISSION, { random: createHelpers('b') });

    expect(first).not.toEqual(second);
  });

  it('settles a wire the same day before the cut-off', () => {
    const timing = registry.settlementFor(profileFor(registry, 'wire'), WEDNESDAY_1500);

    expect(timing.pastCutOff).toBe(false);
    expect(timing.settlesAt.toISOString().slice(0, 10)).toBe('2026-08-05');
  });

  it('pushes a wire past the cut-off to the next banking day', () => {
    const timing = registry.settlementFor(profileFor(registry, 'wire'), WEDNESDAY_1630);

    expect(timing.pastCutOff).toBe(true);
    expect(timing.settlesAt.toISOString().slice(0, 10)).toBe('2026-08-06');
  });

  it('skips the weekend when a T+2 rail would land on a Saturday', () => {
    // 48 hours from Thursday is Saturday; SWIFT must settle on the Monday.
    const thursday = new Date('2026-08-06T09:00:00.000Z');
    const timing = registry.settlementFor(profileFor(registry, 'swift'), thursday);

    expect(timing.settlesAt.getUTCDay()).toBe(1);
  });

  it('rejects everything on a disabled rail without consulting the adapter', async () => {
    const disabled = { ...profileFor(registry, 'ach'), enabled: false };
    const withOutage = buildRegistry([disabled]);

    const result = await withOutage.dispatch('ach', SUBMISSION, { random: createHelpers('x') });

    expect(result.accepted).toBe(false);
    expect(result.accepted ? null : result.code).toBe(RAIL_UNAVAILABLE);
  });

  it('routes on_us through the internal adapter', () => {
    expect(registry.adapterFor('on_us')).toBeInstanceOf(InternalRail);
    expect(registry.adapterFor('internal')).toBeInstanceOf(InternalRail);
  });
});

describe('rail message shapes', () => {
  const clock = new ClockService();
  clock.freeze(WEDNESDAY_1500);

  const context = {
    random: createHelpers('shapes'),
    submittedAt: WEDNESDAY_1500,
    settlesAt: WEDNESDAY_1500,
    pastCutOff: false,
  };

  it('emits an MT103 with the fields a correspondent reads', () => {
    const swift = new SwiftRail();
    const result = swift.submit(SUBMISSION, {
      ...context,
      profile: { ...swift.defaultProfile, failureRate: 0 },
      random: createHelpers('swift-ok'),
    });

    expect(result.accepted).toBe(true);
    expect(result.payload['messageType']).toBe('MT103');
    expect(result.payload[':23B:']).toBe('CRED');
    // SWIFT amounts use a comma decimal separator.
    expect(result.payload[':32A:']).toContain('USD1250,00');
    // One to three eight-character BICs, chained in the order the payment hops them.
    expect(result.payload['correspondentChain']).toMatch(
      /^[A-Z]{6}[A-Z0-9]{2}(>[A-Z]{6}[A-Z0-9]{2}){0,2}$/,
    );
  });

  it('emits ISO-8583 approval and decline codes', () => {
    const card = new CardNetworkRail();

    const approved = card.submit(SUBMISSION, {
      ...context,
      profile: { ...card.defaultProfile, failureRate: 0 },
      random: createHelpers('card-ok'),
    });
    const declined = card.submit(SUBMISSION, {
      ...context,
      profile: { ...card.defaultProfile, failureRate: 1 },
      random: createHelpers('card-bad'),
    });

    expect(approved.payload['DE39']).toBe('00');
    expect(approved.payload['DE38']).toMatch(/^[0-9A-Z]{6}$/);
    expect(['51', '05', '54']).toContain(declined.payload['DE39']);
    expect(declined.payload['DE38']).toBeUndefined();
  });

  it('returns a NACHA return code when an ACH entry fails', () => {
    const ach = new AchRail();
    const result = ach.submit(SUBMISSION, {
      ...context,
      profile: { ...ach.defaultProfile, failureRate: 1 },
      random: createHelpers('ach-return'),
    });

    expect(result.accepted).toBe(false);
    expect(['R01', 'R02', 'R03', 'R04']).toContain(result.accepted ? '' : result.code);
  });
});
