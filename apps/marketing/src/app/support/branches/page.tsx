import type { Metadata } from 'next';

import { PageHeader, Prose, Section } from '@/components/page-header';
import { LOCATIONS } from '@/content/locations';
import { breadcrumbJsonLd, JsonLd } from '@/lib/seo/json-ld';
import { pageMetadata } from '@/lib/seo/metadata';

import { LocationFinder } from './location-finder';

export const metadata: Metadata = pageMetadata({
  title: 'Branches & cash machines',
  description:
    'Find an ICB branch or cash machine — addresses, opening hours, and the services each location offers.',
  path: '/support/branches',
});

export default function BranchesPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Help centre', path: '/support' },
          { name: 'Branches & cash machines', path: '/support/branches' },
        ])}
      />
      <PageHeader
        eyebrow="Support"
        title="Branches & cash machines"
        standfirst="Most things are faster in the app. For the things that are not — cash, a business conversation, a document that needs a stamp — here is where to find us."
      />

      <Section title="Find a location" tone="subtle">
        <LocationFinder locations={LOCATIONS} />
      </Section>

      <Section title="Before you visit">
        <Prose>
          <p>
            Branches keep the hours shown above; cash machines marked &ldquo;open 24 hours&rdquo;
            are available around the clock, including deposits where listed. Every branch has a
            cash machine inside or alongside it.
          </p>
          <p>
            You will never be asked for your password, PIN or full card number in a branch either.
            Staff can verify you from your account and a second factor you control.
          </p>
          <p>
            Cash above a branch&rsquo;s same-day counter limit can be ordered for next-day
            collection from the app — the order is confirmed before you travel.
          </p>
        </Prose>
      </Section>
    </>
  );
}
