import type { RiskAssessment } from '@icb/contracts';
import { Card, CardHeader, StatusBadge } from '@icb/ui';

/**
 * Why the score is what it is.
 *
 * Every rule that fired is shown with its contribution, what was observed, and the threshold it
 * tripped — never collapsed. An analyst releasing a payment is accountable for having seen the
 * reasoning, so the interface does not let it be skipped past.
 */
export function ExplainabilityPanel({
  assessment,
}: Readonly<{ assessment: RiskAssessment }>) {
  const maxContribution = Math.max(1, ...assessment.firedRules.map((rule) => rule.contribution));

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Score explainability"
        description={`Assessed ${assessment.subjectType.replaceAll('_', ' ')} · decision`}
      />
      <div className="flex items-center justify-between gap-4 border-b border-[var(--icb-border)] px-5 py-4">
        <div>
          <p className="text-xs tracking-[0.08em] text-[var(--icb-text-subtle)] uppercase">
            Risk score
          </p>
          <p className="tabular font-display text-3xl font-bold">
            {assessment.score}
            <span className="text-base font-medium text-[var(--icb-text-subtle)]"> / 100</span>
          </p>
        </div>
        <StatusBadge status={assessment.decision} />
      </div>

      {assessment.firedRules.length > 0 ? (
        <ul className="divide-y divide-[var(--icb-border)]">
          {assessment.firedRules.map((rule) => (
            <li key={rule.code} className="px-5 py-3.5">
              <div className="flex items-baseline justify-between gap-4">
                <p className="text-sm font-medium">{rule.label}</p>
                <span className="tabular shrink-0 text-sm font-semibold">
                  +{rule.contribution}
                  <span className="ml-1 text-xs font-normal text-[var(--icb-text-subtle)]">
                    ×{rule.weight}
                  </span>
                </span>
              </div>
              <div
                role="img"
                aria-label={`Contribution ${rule.contribution} points`}
                className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--icb-bg-muted)]"
              >
                <div
                  className="h-full rounded-full bg-[var(--icb-primary)]"
                  style={{ width: `${Math.round((rule.contribution / maxContribution) * 100)}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-[var(--icb-text-subtle)]">
                Observed {rule.observed}
                {rule.threshold ? ` · threshold ${rule.threshold}` : ''}
                <span className="ml-2 font-mono">{rule.code}</span>
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-5 py-4 text-sm text-[var(--icb-text-muted)]">
          No individual rules fired; the score comes from the base model.
        </p>
      )}

      <div className="border-t border-[var(--icb-border)] bg-[var(--icb-bg-subtle)] px-5 py-4">
        <p className="text-xs tracking-[0.08em] text-[var(--icb-text-subtle)] uppercase">
          Narrative
        </p>
        <p className="mt-1.5 text-sm">{assessment.narrative}</p>
      </div>
    </Card>
  );
}
