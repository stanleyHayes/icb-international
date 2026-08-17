import { Card, CardBody, Reveal } from '@icb/ui';
import { Check, ChevronDown } from 'lucide-react';

import { Section } from '@/components/page-header';
import type {
  ProductPageCopy,
  ProductPageFaq,
  ProductPageStep,
} from '@/content/product-pages/types';
import { BUSINESS_STEPS, RETAIL_STEPS } from '@/content/product-pages/types';

/**
 * Feature grid for a product detail page — same card rhythm as the security centre, so a
 * product page and a policy page read as one site.
 */
export function FeatureGrid({
  features,
}: Readonly<{ features: ProductPageCopy['features'] }>) {
  return (
    <Section title="What you get" tone="subtle">
      <div className="grid gap-5 md:grid-cols-2">
        {features.map((feature, index) => (
          <Reveal key={feature.title} delay={index * 60}>
            <Card>
              <CardBody className="pt-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--icb-navy-50)] text-[var(--icb-primary)]">
                  <feature.icon size={20} aria-hidden="true" />
                </div>
                <h3 className="mt-4 text-base font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--icb-text-muted)]">
                  {feature.body}
                </p>
              </CardBody>
            </Card>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

/** Eligibility snapshot beside the application journey, so “can I?” and “how do I?” sit together. */
export function EligibilitySection({ copy }: Readonly<{ copy: ProductPageCopy }>) {
  const steps: readonly ProductPageStep[] =
    copy.category === 'Business' ? BUSINESS_STEPS : RETAIL_STEPS;
  return (
    <Section
      title="Who can apply"
      description="The headline criteria, stated plainly. Full eligibility is confirmed during the application itself."
    >
      <div className="grid gap-5 lg:grid-cols-2">
        <Reveal>
          <Card>
            <CardBody className="pt-6">
              <h3 className="text-xs font-semibold tracking-[0.1em] text-[var(--icb-text-subtle)] uppercase">
                You will need
              </h3>
              <ul className="mt-4 space-y-3">
                {copy.eligibility.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm">
                    <Check
                      size={16}
                      className="mt-0.5 shrink-0 text-[var(--icb-success)]"
                      aria-hidden="true"
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </Reveal>
        <Reveal delay={60}>
          <Card>
            <CardBody className="pt-6">
              <h3 className="text-xs font-semibold tracking-[0.1em] text-[var(--icb-text-subtle)] uppercase">
                How it goes
              </h3>
              <ol className="mt-4 space-y-4">
                {steps.map((step, index) => (
                  <li key={step.title} className="flex items-start gap-3.5">
                    <span
                      aria-hidden="true"
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--icb-navy-50)] text-xs font-bold text-[var(--icb-primary)]"
                    >
                      {index + 1}
                    </span>
                    <div>
                      <p className="text-sm font-semibold">{step.title}</p>
                      <p className="mt-0.5 text-sm leading-relaxed text-[var(--icb-text-muted)]">
                        {step.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>
        </Reveal>
      </div>
    </Section>
  );
}

/** Product FAQs — the same disclosure pattern as the support page, keyboard-complete by default. */
export function FaqSection({ faqs }: Readonly<{ faqs: readonly ProductPageFaq[] }>) {
  return (
    <Section title="Questions, answered" tone="subtle">
      <div className="max-w-3xl space-y-3">
        {faqs.map((faq) => (
          <details
            key={faq.question}
            className="group rounded-[var(--radius-lg)] border border-[var(--icb-border)] bg-[var(--icb-surface)] px-5 py-4 [&[open]]:shadow-[var(--shadow-xs)]"
          >
            <summary className="flex cursor-pointer list-none items-start justify-between gap-4 font-medium">
              {faq.question}
              <ChevronDown
                size={18}
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-[var(--icb-text-subtle)] transition-transform group-open:rotate-180 motion-reduce:transition-none"
              />
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-[var(--icb-text-muted)]">
              {faq.answer}
            </p>
          </details>
        ))}
      </div>
    </Section>
  );
}
