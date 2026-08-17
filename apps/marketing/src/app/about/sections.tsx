import { Card, CardBody, Reveal } from '@icb/ui';

import { Section } from '@/components/page-header';
import { LEADERSHIP, SUSTAINABILITY } from '@/content/company';

/** The leadership grid on the about page. */
export function LeadershipSection() {
  return (
    <Section
      title="Leadership"
      tone="subtle"
      description="The people accountable for the decisions described above. Each owns their area by name."
    >
      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {LEADERSHIP.map((leader, index) => (
          <li key={leader.name}>
            <Reveal delay={Math.min(index, 4) * 60} className="h-full">
              <Card className="h-full">
                <CardBody className="pt-6">
                  <h3 className="text-base font-semibold">{leader.name}</h3>
                  <p className="mt-0.5 text-xs font-semibold tracking-[0.1em] text-[var(--icb-accent-text)] uppercase">
                    {leader.role}
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-[var(--icb-text-muted)]">
                    {leader.bio}
                  </p>
                </CardBody>
              </Card>
            </Reveal>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/** The sustainability commitments on the about page. */
export function SustainabilitySection() {
  return (
    <Section
      id="sustainability"
      title="Sustainability"
      description="A bank’s footprint is mostly the lending it makes and the power it buys. Our commitments cover both, and the reporting to check them against."
    >
      <dl className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
        {SUSTAINABILITY.map((commitment) => (
          <div key={commitment.title}>
            <dt className="text-base font-semibold">{commitment.title}</dt>
            <dd className="mt-2 text-sm leading-relaxed text-[var(--icb-text-muted)]">
              {commitment.body}
            </dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}
