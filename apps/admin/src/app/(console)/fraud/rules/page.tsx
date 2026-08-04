import type { RiskRule } from '@icb/contracts';
import { Card, StatusBadge, formatDate } from '@icb/ui';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { RuleEditor } from '@/features/fraud/rule-editor';
import { api } from '@/lib/api';

export const metadata: Metadata = { title: 'Detection rules' };

const LIST_KINDS = new Set(['allow_list', 'deny_list']);

function kindLabel(kind: RiskRule['kind']): string {
  return kind.replaceAll('_', ' ');
}

/**
 * The rulebook behind the fraud queue.
 *
 * Detection rules and the allow/deny lists are the same mechanism — a rule of kind
 * `allow_list` or `deny_list` short-circuits the score — so they are edited here together,
 * with the lists called out separately because operators think of them differently.
 */
export default async function FraudRulesPage() {
  const { items } = await api<{ items: RiskRule[] }>('/risk/rules');
  const lists = items.filter((rule) => LIST_KINDS.has(rule.kind));
  const rules = items.filter((rule) => !LIST_KINDS.has(rule.kind));

  return (
    <>
      <Link
        href="/fraud"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--icb-text-muted)] transition-colors hover:text-[var(--icb-text)]"
      >
        <ArrowLeft size={15} />
        Fraud alerts
      </Link>

      <header className="mt-4">
        <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">Detection rules</h1>
        <p className="mt-1.5 text-sm text-[var(--icb-text-muted)]">
          Threshold, velocity, geography, device and merchant-category rules. Every change is
          reasoned and audited.
        </p>
      </header>

      <section aria-labelledby="lists-heading" className="mt-8">
        <h2 id="lists-heading" className="text-lg font-semibold">
          Allow &amp; deny lists
        </h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {lists.map((rule) => (
            <RuleCard key={rule.id} rule={rule} />
          ))}
          {lists.length === 0 ? (
            <p className="text-sm text-[var(--icb-text-muted)]">No list rules are configured.</p>
          ) : null}
        </div>
      </section>

      <section aria-labelledby="rules-heading" className="mt-10">
        <h2 id="rules-heading" className="text-lg font-semibold">
          Detection rules
        </h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {rules.map((rule) => (
            <RuleCard key={rule.id} rule={rule} />
          ))}
        </div>
      </section>
    </>
  );
}

function RuleCard({ rule }: Readonly<{ rule: RiskRule }>) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-start justify-between gap-4 border-b border-[var(--icb-border)] px-5 py-4">
        <div>
          <p className="text-sm font-semibold">{rule.label}</p>
          <p className="mt-0.5 text-xs text-[var(--icb-text-subtle)]">
            <span className="font-mono">{rule.code}</span> ·{' '}
            <span className="capitalize">{kindLabel(rule.kind)}</span>
          </p>
          <p className="mt-2 text-sm text-[var(--icb-text-muted)]">{rule.description}</p>
          <p className="mt-2 text-xs text-[var(--icb-text-subtle)]">
            Last changed {formatDate(rule.updatedAt, 'medium')}
            {rule.updatedBy ? ` by ${rule.updatedBy}` : ''}
          </p>
        </div>
        <StatusBadge status={rule.enabled ? 'active' : 'suspended'} />
      </div>
      <RuleEditor rule={rule} />
    </Card>
  );
}
