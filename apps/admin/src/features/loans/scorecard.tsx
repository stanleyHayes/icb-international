import type { LoanDecision } from '@icb/contracts';
import { Card, CardHeader, StatusBadge } from '@icb/ui';

/**
 * The scorecard, with *why*.
 *
 * Factors are listed in full rather than collapsed into a single score: an underwriter
 * overriding a number they cannot see the composition of is guessing, and a decline that
 * cannot be explained cannot be appealed.
 */
export function Scorecard({ decision }: Readonly<{ decision: LoanDecision }>) {
  const maxWeight = Math.max(...decision.factors.map((factor) => factor.weight), 1);

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Scorecard"
        description={`Assessed by ${decision.decidedBy} · band ${decision.band.replaceAll('_', ' ')}`}
      />
      <div className="flex items-center gap-4 border-b border-[var(--icb-border)] px-5 py-4">
        <p className="font-display text-4xl font-extrabold tracking-[-0.02em] tabular">
          {decision.score}
          <span className="text-base font-semibold text-[var(--icb-text-subtle)]">/1000</span>
        </p>
        <StatusBadge status={decision.outcome} />
      </div>

      <ul className="divide-y divide-[var(--icb-border)]">
        {decision.factors.map((factor) => (
          <li key={factor.code} className="px-5 py-3.5">
            <div className="flex items-baseline justify-between gap-4">
              <p className="text-sm font-medium">{factor.label}</p>
              <p className="text-xs tabular text-[var(--icb-text-subtle)]">
                {Math.round(factor.contribution)} pts · weight {Math.round(factor.weight * 100)}%
              </p>
            </div>
            <div
              className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--icb-bg-muted)]"
              role="img"
              aria-label={`${factor.label}: weight ${Math.round(factor.weight * 100)} percent`}
            >
              <div
                className="h-full rounded-full bg-[var(--icb-primary)]"
                style={{ width: `${Math.round((factor.weight / maxWeight) * 100)}%` }}
              />
            </div>
            {factor.detail ? (
              <p className="mt-1.5 text-xs text-[var(--icb-text-subtle)]">{factor.detail}</p>
            ) : null}
          </li>
        ))}
      </ul>

      {decision.reasons.length > 0 ? (
        <div className="border-t border-[var(--icb-border)] px-5 py-4">
          <p className="text-xs font-medium tracking-[0.08em] text-[var(--icb-text-subtle)] uppercase">
            Reasons
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--icb-text-muted)]">
            {decision.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}
