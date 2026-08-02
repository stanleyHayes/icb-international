import { describe, expect, it } from 'vitest';

import { DEFAULT_RULES } from '../../default-rules.js';
import { buildNarrative } from '../../narrative.js';
import { runRules } from '../../rule-engine.js';
import {
  DEFAULT_DECISION_THRESHOLDS,
  decideFrom,
  normaliseThresholds,
  scoreOf,
  severityFor,
} from '../../scoring.js';
import { amountAnomalyRule, distributionOf } from '../amount-anomaly.rule.js';
import { deviceChangeRule } from '../device-change.rule.js';
import { dormantReactivationRule } from '../dormant-reactivation.rule.js';
import { countryDistanceKm, haversineKm } from '../geo-distance.js';
import { geoVelocityRule } from '../geo-velocity.rule.js';
import { mccRiskRule } from '../mcc-risk.rule.js';
import { newBeneficiaryRule } from '../new-beneficiary.rule.js';
import { RULE_EVALUATORS } from '../index.js';
import { MS_PER_DAY, MS_PER_HOUR, MS_PER_MINUTE, severity } from '../rule.params.js';
import type { HistoryPoint, RuleContext } from '../rule.types.js';
import { structuringRule } from '../structuring.rule.js';
import { timeOfDayRule } from '../time-of-day.rule.js';
import { velocityRule } from '../velocity.rule.js';

const NOW = new Date('2026-08-02T14:00:00.000Z');
const CUSTOMER = '01JZ8QY3N7K4M2P9R5T6V8W0XA';
const BENEFICIARY = '01JZ8QY3N7K4M2P9R5T6V8W0XB';

function context(overrides: Partial<RuleContext> = {}): RuleContext {
  return {
    customerId: CUSTOMER,
    amountMinorUnits: 25_000,
    currency: 'USD',
    at: NOW,
    history: [],
    beneficiaryId: null,
    knownBeneficiaryIds: [],
    countryCode: null,
    lastCountryCode: null,
    lastCountryAt: null,
    deviceId: null,
    knownDeviceIds: [],
    mcc: null,
    lastActivityAt: null,
    ...overrides,
  };
}

/** `count` movements spaced `spacingMs` apart, walking backwards from now. */
function recent(count: number, spacingMs: number, minorUnits = 10_000): HistoryPoint[] {
  return Array.from({ length: count }, (_, index) => ({
    minorUnits,
    at: new Date(NOW.getTime() - (index + 1) * spacingMs),
  }));
}

function ruleParameters(code: string): Record<string, string | number | boolean> {
  const seed = DEFAULT_RULES.find((rule) => rule.code === code);
  if (!seed) {
    throw new Error(`No seeded rule with code ${code}`);
  }
  return { ...seed.parameters };
}

describe('rule engine invariants', () => {
  it('has an evaluator for every seeded rule kind', () => {
    for (const seed of DEFAULT_RULES) {
      expect(RULE_EVALUATORS[seed.kind], seed.code).toBeTypeOf('function');
    }
  });

  it('always reports what it observed, fired or not', () => {
    const quiet = context();
    for (const seed of DEFAULT_RULES) {
      const evaluate = RULE_EVALUATORS[seed.kind];
      const outcome = evaluate?.(quiet, seed.parameters);
      expect(outcome?.observed, seed.code).toBeTruthy();
      expect(outcome?.fired, seed.code).toBe(false);
    }
  });

  it('is pure: the same context twice gives the same answer', () => {
    const input = context({ history: recent(9, MS_PER_MINUTE) });
    expect(velocityRule(input, ruleParameters('VELOCITY_BURST'))).toEqual(
      velocityRule(input, ruleParameters('VELOCITY_BURST')),
    );
  });
});

describe('severity shaping', () => {
  it('earns half the weight on crossing and all of it at saturation', () => {
    expect(severity(10, 10, 2)).toBe(0.5);
    expect(severity(20, 10, 2)).toBe(1);
    expect(severity(15, 10, 2)).toBe(0.75);
  });

  it('never leaves the unit interval', () => {
    expect(severity(1000, 10, 2)).toBe(1);
    expect(severity(1, 10, 2)).toBe(0.5);
    expect(severity(5, 0, 2)).toBe(1);
  });
});

describe('velocity', () => {
  const parameters = ruleParameters('VELOCITY_BURST');

  it('counts the event under assessment, not just history', () => {
    // Four prior movements plus this one is five: exactly at the limit, so silent.
    expect(velocityRule(context({ history: recent(4, MS_PER_MINUTE) }), parameters).fired).toBe(false);
    expect(velocityRule(context({ history: recent(5, MS_PER_MINUTE) }), parameters).fired).toBe(true);
  });

  it('ignores movements outside the window', () => {
    const outcome = velocityRule(context({ history: recent(20, 2 * MS_PER_HOUR) }), parameters);
    expect(outcome.fired).toBe(false);
    expect(outcome.observed).toContain('1 movements');
  });

  it('escalates with the size of the burst', () => {
    const mild = velocityRule(context({ history: recent(6, MS_PER_MINUTE) }), parameters);
    const severe = velocityRule(context({ history: recent(40, MS_PER_MINUTE) }), parameters);
    expect(severe.contribution).toBeGreaterThan(mild.contribution);
    expect(severe.contribution).toBe(1);
  });
});

describe('amount anomaly', () => {
  const parameters = ruleParameters('AMOUNT_ANOMALY');

  it('says nothing until there is enough history to be wrong about', () => {
    const outcome = amountAnomalyRule(
      context({ amountMinorUnits: 5_000_000, history: recent(3, MS_PER_DAY) }),
      parameters,
    );
    expect(outcome.fired).toBe(false);
    expect(outcome.observed).toContain('too little history');
  });

  it('fires on an amount far outside the customer’s own distribution', () => {
    const outcome = amountAnomalyRule(
      context({ amountMinorUnits: 5_000_000, history: recent(12, MS_PER_DAY, 10_000) }),
      parameters,
    );
    expect(outcome.fired).toBe(true);
    expect(outcome.observed).toContain('standard deviations');
    expect(outcome.threshold).toBe('3.0 standard deviations');
  });

  it('does not punish a customer who always moves large sums', () => {
    const history = recent(12, MS_PER_DAY, 5_000_000);
    expect(amountAnomalyRule(context({ amountMinorUnits: 5_100_000, history }), parameters).fired).toBe(
      false,
    );
  });

  it('never fires on an amount below the customer’s mean', () => {
    const history = recent(12, MS_PER_DAY, 500_000);
    expect(amountAnomalyRule(context({ amountMinorUnits: 100, history }), parameters).fired).toBe(false);
  });

  it('survives a customer whose every payment is identical', () => {
    const history = recent(12, MS_PER_DAY, 20_000);
    const outcome = amountAnomalyRule(context({ amountMinorUnits: 20_100, history }), parameters);
    expect(distributionOf(history).standardDeviation).toBe(0);
    expect(outcome.fired).toBe(false);
    expect(outcome.contribution).toBe(0);
  });
});

describe('new beneficiary', () => {
  const parameters = ruleParameters('NEW_BENEFICIARY');

  it('stays quiet for a payee already paid', () => {
    const outcome = newBeneficiaryRule(
      context({
        amountMinorUnits: 500_000,
        beneficiaryId: BENEFICIARY,
        knownBeneficiaryIds: [BENEFICIARY],
      }),
      parameters,
    );
    expect(outcome.fired).toBe(false);
  });

  it('fires on a material first payment', () => {
    const outcome = newBeneficiaryRule(
      context({ amountMinorUnits: 500_000, beneficiaryId: BENEFICIARY }),
      parameters,
    );
    expect(outcome.fired).toBe(true);
    expect(outcome.observed).toContain('never paid before');
  });

  it('ignores a small first payment', () => {
    expect(
      newBeneficiaryRule(context({ amountMinorUnits: 500, beneficiaryId: BENEFICIARY }), parameters)
        .fired,
    ).toBe(false);
  });
});

describe('geo velocity', () => {
  const parameters = ruleParameters('GEO_VELOCITY');

  it('measures real distance between known countries', () => {
    expect(countryDistanceKm('GH', 'GB')).toBeGreaterThan(4000);
    expect(countryDistanceKm('GH', 'ZZ')).toBeNull();
    expect(haversineKm([0, 0], [0, 0])).toBe(0);
  });

  it('fires on travel no human could have made', () => {
    const outcome = geoVelocityRule(
      context({
        countryCode: 'JP',
        lastCountryCode: 'GH',
        lastCountryAt: new Date(NOW.getTime() - 20 * MS_PER_MINUTE),
      }),
      parameters,
    );
    expect(outcome.fired).toBe(true);
    expect(outcome.contribution).toBe(1);
    expect(outcome.observed).toContain('km/h');
  });

  it('accepts an ordinary long-haul flight', () => {
    const outcome = geoVelocityRule(
      context({
        countryCode: 'GB',
        lastCountryCode: 'GH',
        lastCountryAt: new Date(NOW.getTime() - 9 * MS_PER_HOUR),
      }),
      parameters,
    );
    expect(outcome.fired).toBe(false);
  });

  it('falls back to elapsed time when a country is not on the map', () => {
    const outcome = geoVelocityRule(
      context({
        countryCode: 'ZZ',
        lastCountryCode: 'GH',
        lastCountryAt: new Date(NOW.getTime() - 5 * MS_PER_MINUTE),
      }),
      parameters,
    );
    expect(outcome.fired).toBe(true);
    expect(outcome.observed).toContain('distance unknown');
  });

  it('says nothing when the country has not changed', () => {
    const outcome = geoVelocityRule(
      context({ countryCode: 'GH', lastCountryCode: 'gh', lastCountryAt: NOW }),
      parameters,
    );
    expect(outcome.fired).toBe(false);
  });
});

describe('device change', () => {
  const parameters = ruleParameters('DEVICE_CHANGE');

  it('is silent on a customer’s very first device', () => {
    expect(deviceChangeRule(context({ deviceId: 'device-a' }), parameters).fired).toBe(false);
  });

  it('fires on an unrecognised device', () => {
    const outcome = deviceChangeRule(
      context({ amountMinorUnits: 200_000, deviceId: 'device-b', knownDeviceIds: ['device-a'] }),
      parameters,
    );
    expect(outcome.fired).toBe(true);
    expect(outcome.contribution).toBe(1);
  });

  it('weighs a small amount from a new device more lightly', () => {
    const outcome = deviceChangeRule(
      context({ amountMinorUnits: 100, deviceId: 'device-b', knownDeviceIds: ['device-a'] }),
      parameters,
    );
    expect(outcome.fired).toBe(true);
    expect(outcome.contribution).toBeLessThan(1);
  });
});

describe('merchant category risk', () => {
  const parameters = ruleParameters('MCC_RISK');

  it('separates high risk from merely elevated', () => {
    const gambling = mccRiskRule(context({ mcc: '7995' }), parameters);
    const bar = mccRiskRule(context({ mcc: '5813' }), parameters);
    expect(gambling.contribution).toBe(1);
    expect(bar.fired).toBe(true);
    expect(bar.contribution).toBeLessThan(gambling.contribution);
  });

  it('ignores an ordinary merchant', () => {
    expect(mccRiskRule(context({ mcc: '5411' }), parameters).fired).toBe(false);
  });

  it('honours an operator-edited list', () => {
    expect(mccRiskRule(context({ mcc: '5411' }), { highRiskMccs: '5411' }).fired).toBe(true);
  });
});

describe('time of day', () => {
  const parameters = ruleParameters('ODD_HOURS');

  it('fires inside the overnight window', () => {
    const outcome = timeOfDayRule(
      context({ at: new Date('2026-08-02T03:30:00.000Z') }),
      parameters,
    );
    expect(outcome.fired).toBe(true);
    expect(outcome.observed).toContain('03:00');
  });

  it('stays quiet during the day', () => {
    expect(timeOfDayRule(context(), parameters).fired).toBe(false);
  });

  it('handles a window that wraps midnight', () => {
    const wrapping = { startHourUtc: 23, endHourUtc: 5 };
    expect(timeOfDayRule(context({ at: new Date('2026-08-02T23:30:00.000Z') }), wrapping).fired).toBe(
      true,
    );
    expect(timeOfDayRule(context({ at: new Date('2026-08-02T12:00:00.000Z') }), wrapping).fired).toBe(
      false,
    );
  });
});

describe('dormant reactivation', () => {
  const parameters = ruleParameters('DORMANT_REACTIVATION');

  it('fires on a long silence followed by real money', () => {
    const outcome = dormantReactivationRule(
      context({
        amountMinorUnits: 400_000,
        lastActivityAt: new Date(NOW.getTime() - 200 * MS_PER_DAY),
      }),
      parameters,
    );
    expect(outcome.fired).toBe(true);
    expect(outcome.observed).toContain('200 days');
  });

  it('ignores a small amount after a long silence', () => {
    expect(
      dormantReactivationRule(
        context({ amountMinorUnits: 500, lastActivityAt: new Date(NOW.getTime() - 200 * MS_PER_DAY) }),
        parameters,
      ).fired,
    ).toBe(false);
  });

  it('ignores an active account', () => {
    expect(
      dormantReactivationRule(
        context({ amountMinorUnits: 400_000, lastActivityAt: new Date(NOW.getTime() - MS_PER_DAY) }),
        parameters,
      ).fired,
    ).toBe(false);
  });
});

describe('structuring', () => {
  const parameters = ruleParameters('STRUCTURING');

  it('fires on repeated amounts parked under the reporting line', () => {
    const outcome = structuringRule(
      context({ amountMinorUnits: 980_000, history: recent(3, MS_PER_HOUR, 970_000) }),
      parameters,
    );
    expect(outcome.fired).toBe(true);
    expect(outcome.observed).toContain('4 amounts');
  });

  it('ignores ordinary mixed spending', () => {
    expect(
      structuringRule(
        context({ amountMinorUnits: 980_000, history: recent(9, MS_PER_HOUR, 2_000) }),
        parameters,
      ).fired,
    ).toBe(false);
  });

  it('ignores an amount over the line — that one is simply reported', () => {
    const outcome = structuringRule(
      context({ amountMinorUnits: 1_400_000, history: recent(5, MS_PER_HOUR, 970_000) }),
      parameters,
    );
    expect(outcome.fired).toBe(false);
    expect(outcome.observed).toContain('not just under');
  });

  it('ignores in-band amounts outside the window', () => {
    expect(
      structuringRule(
        context({ amountMinorUnits: 980_000, history: recent(6, 40 * MS_PER_HOUR, 970_000) }),
        parameters,
      ).fired,
    ).toBe(false);
  });
});

describe('scoring and decisions', () => {
  const rules = DEFAULT_RULES.map((seed, index) => ({
    id: `01JZ8QY3N7K4M2P9R5T6V8W0${String(index).padStart(2, '0')}`,
    code: seed.code,
    label: seed.label,
    description: seed.description,
    kind: seed.kind,
    enabled: true,
    weight: seed.weight,
    parameters: seed.parameters,
    updatedBy: null,
    updatedAt: NOW.toISOString(),
  }));

  it('allows an unremarkable payment', () => {
    const firedRules = runRules(rules, context({ history: recent(10, 3 * MS_PER_DAY, 24_000) }));
    expect(firedRules).toHaveLength(0);
    expect(decideFrom(scoreOf(firedRules), DEFAULT_DECISION_THRESHOLDS)).toBe('allow');
  });

  it('blocks a payment that trips everything at once', () => {
    const firedRules = runRules(
      rules,
      context({
        amountMinorUnits: 980_000,
        at: new Date('2026-08-02T03:00:00.000Z'),
        history: recent(10, MS_PER_MINUTE, 970_000),
        beneficiaryId: BENEFICIARY,
        countryCode: 'JP',
        lastCountryCode: 'GH',
        lastCountryAt: new Date(NOW.getTime() - 30 * MS_PER_MINUTE),
        deviceId: 'device-b',
        knownDeviceIds: ['device-a'],
        mcc: '7995',
        lastActivityAt: new Date(NOW.getTime() - 300 * MS_PER_DAY),
      }),
    );

    const score = scoreOf(firedRules);
    expect(firedRules.length).toBeGreaterThanOrEqual(6);
    expect(score).toBe(100);
    expect(decideFrom(score, DEFAULT_DECISION_THRESHOLDS)).toBe('block');
    expect(severityFor('block', score)).toBe('critical');
  });

  it('orders fired rules by how much they contributed', () => {
    const firedRules = runRules(
      rules,
      context({
        amountMinorUnits: 980_000,
        history: recent(8, MS_PER_HOUR, 970_000),
        at: new Date('2026-08-02T03:00:00.000Z'),
      }),
    );
    const contributions = firedRules.map((rule) => rule.contribution);
    expect(contributions).toEqual([...contributions].sort((left, right) => right - left));
  });

  it('skips a disabled rule entirely', () => {
    const disabled = rules.map((rule) => ({ ...rule, enabled: false }));
    expect(runRules(disabled, context({ mcc: '7995' }))).toHaveLength(0);
  });

  it('keeps the decision bands strictly increasing however they are configured', () => {
    const inverted = normaliseThresholds({ challenge: 90, review: 10, block: 5 });
    expect(inverted.challenge).toBeLessThanOrEqual(inverted.review);
    expect(inverted.review).toBeLessThanOrEqual(inverted.block);
    expect(decideFrom(95, inverted)).toBe('block');
  });

  it('maps each band to a decision', () => {
    expect(decideFrom(0, DEFAULT_DECISION_THRESHOLDS)).toBe('allow');
    expect(decideFrom(25, DEFAULT_DECISION_THRESHOLDS)).toBe('challenge');
    expect(decideFrom(50, DEFAULT_DECISION_THRESHOLDS)).toBe('review');
    expect(decideFrom(80, DEFAULT_DECISION_THRESHOLDS)).toBe('block');
  });
});

describe('narrative', () => {
  it('names every fired rule and its contribution', () => {
    const firedRules = [
      {
        code: 'STRUCTURING',
        label: 'Structuring below the reporting line',
        weight: 25,
        contribution: 20,
        observed: '4 amounts just under the line',
        threshold: 'fewer than 3',
      },
      {
        code: 'ODD_HOURS',
        label: 'Overnight activity',
        weight: 6,
        contribution: 6,
        observed: 'Event at 03:00 UTC',
        threshold: null,
      },
    ];

    const narrative = buildNarrative({
      subjectType: 'transfer',
      subjectId: CUSTOMER,
      amountMinorUnits: 980_000,
      currency: 'USD',
      score: 26,
      decision: 'challenge',
      firedRules,
      rulesConsidered: 9,
    });

    expect(narrative).toContain('26/100');
    expect(narrative).toContain('2 of 9 active rules fired');
    expect(narrative).toContain('Structuring below the reporting line');
    expect(narrative).toContain('Overnight activity');
    expect(narrative).toContain('re-authenticate');
    expect(narrative).toContain('largest single driver');
  });

  it('says so plainly when nothing fired', () => {
    const narrative = buildNarrative({
      subjectType: 'card_authorisation',
      subjectId: CUSTOMER,
      amountMinorUnits: 1_200,
      currency: 'USD',
      score: 0,
      decision: 'allow',
      firedRules: [],
      rulesConsidered: 9,
    });
    expect(narrative).toContain('No rule fired');
    expect(narrative).toContain('Allowed without friction');
  });
});
