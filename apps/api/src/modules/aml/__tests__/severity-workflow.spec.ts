import type { AlertSeverity, AmlAlertKind, CaseStatus } from '@icb/contracts';
import { describe, expect, it } from 'vitest';

import { ValidationError } from '../../../common/errors/index.js';
import { assertTransition } from '../domain/case-workflow.js';
import { buildAlertNarrative, buildReportDraft } from '../domain/narrative.js';
import type { ScenarioHit } from '../domain/scenario.types.js';
import { severityFor } from '../domain/severity.js';

function hit(overrides: Partial<ScenarioHit> = {}): ScenarioHit {
  return {
    kind: 'structuring',
    matchDetail: 'some detail',
    matchScore: null,
    relatedTransactionIds: ['t1'],
    aggregateMinorUnits: null,
    currency: null,
    ...overrides,
  };
}

describe('severityFor', () => {
  const BASE: readonly [AmlAlertKind, AlertSeverity][] = [
    ['sanctions_match', 'critical'],
    ['pep_match', 'high'],
    ['adverse_media', 'medium'],
    ['structuring', 'high'],
    ['rapid_movement', 'medium'],
    ['round_amount_pattern', 'low'],
    ['high_risk_corridor', 'high'],
    ['threshold_aggregation', 'high'],
  ];

  it.each(BASE)('maps %s to %s', (kind, expected) => {
    expect(severityFor(hit({ kind }))).toBe(expected);
  });

  it('escalates one band when the aggregate dwarfs the reporting threshold', () => {
    expect(severityFor(hit({ kind: 'round_amount_pattern', aggregateMinorUnits: 3_500_000, currency: 'USD' }))).toBe('medium');
    expect(severityFor(hit({ kind: 'rapid_movement', aggregateMinorUnits: 3_000_000, currency: 'USD' }))).toBe('high');
  });

  it('escalates one band on a name match too strong to be someone else', () => {
    expect(severityFor(hit({ kind: 'adverse_media', matchScore: 0.95 }))).toBe('high');
    expect(severityFor(hit({ kind: 'pep_match', matchScore: 0.72 }))).toBe('high');
  });

  it('never goes above critical', () => {
    expect(severityFor(hit({ kind: 'sanctions_match', matchScore: 1 }))).toBe('critical');
  });
});

describe('assertTransition', () => {
  const LEGAL: readonly [CaseStatus, CaseStatus][] = [
    ['open', 'investigating'],
    ['open', 'escalated'],
    ['open', 'dismissed'],
    ['investigating', 'escalated'],
    ['investigating', 'closed'],
    ['escalated', 'closed'],
    ['escalated', 'dismissed'],
  ];

  it.each(LEGAL)('allows %s → %s', (from, to) => {
    expect(() => assertTransition(from, to)).not.toThrow();
  });

  it('rejects moves out of a terminal state', () => {
    expect(() => assertTransition('closed', 'open')).toThrow(ValidationError);
    expect(() => assertTransition('dismissed', 'investigating')).toThrow(ValidationError);
  });

  it('rejects de-escalation back into the queue', () => {
    expect(() => assertTransition('escalated', 'investigating')).toThrow(ValidationError);
    expect(() => assertTransition('investigating', 'open')).toThrow(ValidationError);
  });

  it('allows a no-op status write', () => {
    expect(() => assertTransition('open', 'open')).not.toThrow();
    expect(() => assertTransition('closed', 'closed')).not.toThrow();
  });
});

describe('buildAlertNarrative', () => {
  it('names the customer, the severity, and what fired', () => {
    const narrative = buildAlertNarrative({
      customerName: 'Amara Mensah',
      severity: 'high',
      hit: hit({ kind: 'structuring', matchDetail: '3 credits below the threshold', relatedTransactionIds: ['a', 'b'] }),
    });

    expect(narrative).toContain('Amara Mensah');
    expect(narrative).toContain('high');
    expect(narrative).toContain('structuring');
    expect(narrative).toContain('3 credits below the threshold');
    expect(narrative).toContain('2 related transaction(s)');
  });
});

describe('buildReportDraft', () => {
  const base = {
    reference: 'SAR-ABCDEFGH',
    customerName: 'Amara Mensah',
    customerId: 'cust-1',
    alertKind: 'structuring' as const,
    matchDetail: '3 credits below the threshold',
    aggregateMinorUnits: 2_650_000,
    currency: 'USD',
    transactionCount: 3,
    preparedBy: 'officer@icb.example',
    preparedAt: new Date('2026-08-02T12:00:00.000Z'),
  };

  it('titles a SAR draft as a SAR', () => {
    const draft = buildReportDraft({ ...base, reportKind: 'sar' });
    expect(draft).toContain('SUSPICIOUS ACTIVITY REPORT');
    expect(draft).toContain('SAR-ABCDEFGH');
    expect(draft).toContain('Amara Mensah');
    expect(draft).toContain('2_650_000'.replace(/_/g, ''));
  });

  it('titles a CTR draft as a CTR', () => {
    const draft = buildReportDraft({ ...base, reportKind: 'ctr' });
    expect(draft).toContain('CURRENCY TRANSACTION REPORT');
  });

  it('says so when nothing was aggregated', () => {
    const draft = buildReportDraft({ ...base, reportKind: 'sar', aggregateMinorUnits: null, currency: null });
    expect(draft).toContain('not aggregated');
  });
});
