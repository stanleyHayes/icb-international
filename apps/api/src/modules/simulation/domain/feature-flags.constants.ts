/**
 * The flags ICB ships with.
 *
 * Seeded into `feature_flags` on first read so the control room is never empty and so a flag has
 * a description an operator can act on. Flipping one changes behaviour immediately — there is no
 * cache in front of this, because a stale toggle during a demo looks exactly like a bug.
 */
export interface FeatureFlagSeed {
  readonly key: string;
  readonly label: string;
  readonly description: string;
  readonly enabled: boolean;
  readonly rolloutPercentage: number;
  readonly audience: 'all' | 'staff' | 'beta' | 'tier_premier_plus';
}

export const DEFAULT_FEATURE_FLAGS: readonly FeatureFlagSeed[] = [
  {
    key: 'instant_card_issuance',
    label: 'Instant card issuance',
    description: 'Issue a virtual card immediately on approval instead of waiting for the batch.',
    enabled: true,
    rolloutPercentage: 100,
    audience: 'all',
  },
  {
    key: 'savings_goals',
    label: 'Savings goals',
    description: 'Goal-based savings pots with round-ups and scheduled contributions.',
    enabled: true,
    rolloutPercentage: 100,
    audience: 'all',
  },
  {
    key: 'swift_outbound',
    label: 'Outbound SWIFT transfers',
    description: 'Allow customers to send cross-border payments over SWIFT.',
    enabled: true,
    rolloutPercentage: 100,
    audience: 'all',
  },
  {
    key: 'spend_insights',
    label: 'Spending insights',
    description: 'Categorised spending analysis and month-on-month comparisons.',
    enabled: false,
    rolloutPercentage: 10,
    audience: 'beta',
  },
  {
    key: 'statement_redesign',
    label: 'Redesigned statements',
    description: 'The new statement layout, verified against the ledger before wider release.',
    enabled: false,
    rolloutPercentage: 0,
    audience: 'staff',
  },
  {
    key: 'concierge_support',
    label: 'Concierge support queue',
    description: 'Priority routing to a named relationship manager.',
    enabled: true,
    rolloutPercentage: 100,
    audience: 'tier_premier_plus',
  },
  {
    key: 'step_up_on_new_payee',
    label: 'Step-up on a new payee',
    description: 'Require re-authentication the first time money is sent to a new beneficiary.',
    enabled: true,
    rolloutPercentage: 100,
    audience: 'all',
  },
];
