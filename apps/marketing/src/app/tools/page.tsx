import type { Metadata } from 'next';

import { AffordabilityCheck } from '@/components/calculators/affordability-check';
import { FxConverter } from '@/components/calculators/fx-converter';
import { LoanCalculator } from '@/components/calculators/loan-calculator';
import { SavingsGoalCalculator } from '@/components/calculators/savings-goal-calculator';
import { PageHeader, Section } from '@/components/page-header';
import { breadcrumbJsonLd, JsonLd } from '@/lib/seo/json-ld';
import { pageMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = pageMetadata({
  title: 'Calculators & tools',
  description:
    'Work out a loan repayment, plan a savings goal, convert between currencies and check what you can afford — with the same maths the bank uses.',
  path: '/tools',
});

const TOOLS_NAV = [
  { href: '#loan-calculator', label: 'Loan' },
  { href: '#savings-goal', label: 'Savings goal' },
  { href: '#fx-converter', label: 'Currency' },
  { href: '#affordability', label: 'Affordability' },
] as const;

/**
 * The tools page: four calculators, all client-side, all integer arithmetic.
 *
 * These are planning tools, not quotes — the figures are exact for the inputs given, and the
 * copy says so where a real application would price differently.
 */
export default function ToolsPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Calculators & tools', path: '/tools' },
        ])}
      />
      <PageHeader
        eyebrow="Tools"
        title="Do the maths before you commit"
        standfirst="Four calculators that run the same integer arithmetic the bank's own engines use. Nothing you type leaves your browser."
      >
        <nav aria-label="Calculators" className="flex flex-wrap gap-2">
          {TOOLS_NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-full border border-[var(--icb-border)] bg-[var(--icb-bg)] px-4 py-1.5 text-sm font-medium text-[var(--icb-text-muted)] transition-colors hover:border-[var(--icb-primary)] hover:text-[var(--icb-primary)]"
            >
              {item.label}
            </a>
          ))}
        </nav>
      </PageHeader>

      <Section
        id="loan-calculator"
        title="Loan calculator"
        tone="subtle"
        description="The fixed monthly payment on an amortising loan, and what the loan costs in total. Your offered rate depends on the amount, the term and your circumstances."
      >
        <LoanCalculator />
      </Section>

      <Section
        id="savings-goal"
        title="Savings-goal calculator"
        description="How long a goal takes at a given monthly contribution, with interest compounding monthly."
      >
        <SavingsGoalCalculator />
      </Section>

      <Section
        id="fx-converter"
        title="Currency converter"
        tone="subtle"
        description="Convert between major currencies at an indicative mid rate you can edit — useful for checking a quote you were given elsewhere."
      >
        <FxConverter />
      </Section>

      <Section
        id="affordability"
        title="Affordability check"
        description="Would the repayment on a new loan fit beside your existing commitments? The thresholds shown are the ones a lender applies."
      >
        <AffordabilityCheck />
      </Section>
    </>
  );
}
