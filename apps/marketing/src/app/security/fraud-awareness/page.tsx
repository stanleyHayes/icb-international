import { Card, CardBody } from '@icb/ui';
import type { Metadata } from 'next';

import { PageHeader, Prose, Section } from '@/components/page-header';
import { breadcrumbJsonLd, JsonLd } from '@/lib/seo/json-ld';
import { pageMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = pageMetadata({
  title: 'Fraud awareness',
  description:
    'The scams that reach ICB customers most often, the warning sign each one carries, and what to do in the first ten minutes if you are caught.',
  path: '/security/fraud-awareness',
});

const SCAMS = [
  {
    name: 'The bank impersonation call',
    shape: 'A caller claims to be ICB’s fraud team, says your account is under attack, and asks you to move money to a “safe account” or read out a code.',
    tell: 'We never ask you to move money, and we never ask for a code. The urgency is the tell — a real fraud team slows things down, it does not hurry you.',
  },
  {
    name: 'The delivery or customs text',
    shape: 'A message about a missed parcel or an unpaid fee links to a page that harvests your card details, which are then used online.',
    tell: 'The link is the payload. Weigh the fee being asked for — a few cedis to release a parcel — against how rarely any legitimate delivery works that way.',
  },
  {
    name: 'The purchase scam',
    shape: 'Goods at a price too good to be real, paid by transfer to a “seller” who then disappears. Transfers are final in a way card payments are not.',
    tell: 'A seller who refuses a card payment or an escrow and insists on a direct transfer is telling you how they intend to be untraceable.',
  },
  {
    name: 'The investment approach',
    shape: 'An unsolicited approach — often through social media — offers guaranteed returns, shows a convincing dashboard, and encourages larger and larger deposits.',
    tell: 'Guaranteed high returns do not exist. A dashboard that only ever goes up, and a withdrawal that always has one more fee before it, is the pattern.',
  },
  {
    name: 'The romance or friendship con',
    shape: 'A relationship built over weeks turns to an emergency — medical, customs, travel — that only your transfer can solve.',
    tell: 'The emergency is always urgent, always untraceable, and always followed by another. Anyone you have not met who asks for money is a risk, full stop.',
  },
] as const;

const FIRST_TEN_MINUTES = [
  'Freeze the affected card in the app. It takes effect immediately, before you speak to anyone.',
  'Sign out of every device from Settings, then change your password.',
  'Raise a dispute on the transaction. Provisional credit is assessed within 48 hours.',
  'Message us through the app’s secure thread. Do not call a number from a search result or from the message itself.',
] as const;

export default function FraudAwarenessPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Security centre', path: '/security' },
          { name: 'Fraud awareness', path: '/security/fraud-awareness' },
        ])}
      />
      <PageHeader
        eyebrow="Security centre"
        title="Fraud awareness"
        standfirst="Most fraud does not defeat the bank’s systems; it persuades the customer. These are the five approaches we see most, and the one detail that gives each away."
      />

      <Section
        title="The five approaches we see most"
        tone="subtle"
        description="Each has a single warning sign that does not change, however polished the presentation."
      >
        <div className="grid gap-5 md:grid-cols-2">
          {SCAMS.map((scam) => (
            <Card key={scam.name}>
              <CardBody className="pt-6">
                <h3 className="text-base font-semibold">{scam.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--icb-text-muted)]">
                  {scam.shape}
                </p>
                <p className="mt-3 border-l-2 border-[var(--icb-accent)] pl-3 text-sm leading-relaxed">
                  <strong>The tell:</strong> {scam.tell}
                </p>
              </CardBody>
            </Card>
          ))}
        </div>
      </Section>

      <Section title="If you think you have been caught">
        <Prose>
          <p>
            Speed matters more than embarrassment. Most losses are limited by what happens in the
            first ten minutes, and nobody at ICB will make you feel foolish — we would rather hear
            about a near miss than not hear about a loss.
          </p>
          <h2>The first ten minutes</h2>
          <ul>
            {FIRST_TEN_MINUTES.map((step) => (
              <li key={step.slice(0, 40)}>{step}</li>
            ))}
          </ul>
          <h2>What happens next</h2>
          <p>
            Your dispute is picked up by a named case owner, not a queue. You are told what
            evidence we hold, what the card scheme’s deadline is, and the reason for the outcome —
            upheld or not. If the money moved to another bank, we raise a recall the same day and
            tell you what the receiving bank said.
          </p>
          <p>
            Reporting a scam attempt that failed is just as useful. The number, the message and
            the approach go into the rule engine and protect the next customer it targets.
          </p>
        </Prose>
      </Section>
    </>
  );
}
