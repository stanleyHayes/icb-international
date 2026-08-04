'use client';

import { Input, RadioGroup } from '@icb/ui';
import { MapPin, Search } from 'lucide-react';
import { useId, useMemo, useState } from 'react';

import type { Location } from '@/content/locations';
import { LOCATION_CITIES } from '@/content/locations';

type KindFilter = 'all' | 'Branch' | 'Cash machine';

const KIND_OPTIONS = [
  { value: 'all', label: 'All locations' },
  { value: 'Branch', label: 'Branches' },
  { value: 'Cash machine', label: 'Cash machines' },
] as const;

function matches(location: Location, query: string, kind: KindFilter): boolean {
  if (kind !== 'all' && location.kind !== kind) return false;
  if (!query.trim()) return true;
  const haystack = [location.name, location.city, location.address, ...location.services]
    .join(' ')
    .toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack.includes(term));
}

/**
 * Branch and cash-machine locator.
 *
 * The list is the accessible source of truth. The panel beside it is a labelled map
 * placeholder: no external map API is called, and everything the map would convey is stated
 * in its accessible name and available in the list.
 */
export function LocationFinder({ locations }: Readonly<{ locations: readonly Location[] }>) {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<KindFilter>('all');
  const inputId = useId();

  const results = useMemo(
    () => locations.filter((location) => matches(location, query, kind)),
    [locations, query, kind],
  );

  const mapLabel = `Map placeholder. ${locations.length} locations across ${LOCATION_CITIES.join(
    ', ',
  )}. Use the list on this page for addresses, hours and services.`;

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr]">
      <div
        role="img"
        aria-label={mapLabel}
        className="flex min-h-[320px] flex-col items-center justify-center rounded-[var(--radius-lg)] border border-[var(--icb-border)] bg-[var(--icb-bg-subtle)] p-8 text-center"
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--icb-navy-50)] text-[var(--icb-primary)]">
          <MapPin size={22} aria-hidden="true" />
        </span>
        <p className="mt-4 font-medium">Map view</p>
        <p className="mt-1 max-w-xs text-sm leading-relaxed text-[var(--icb-text-muted)]">
          {locations.length} locations across {LOCATION_CITIES.length} cities. Addresses, hours
          and services are listed opposite.
        </p>
      </div>

      <div>
        <div className="relative">
          <Search
            size={18}
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-[var(--icb-text-subtle)]"
          />
          <label htmlFor={inputId} className="sr-only">
            Search by city, address or service
          </label>
          <Input
            id={inputId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by city, address or service…"
            autoComplete="off"
            className="pl-10"
          />
        </div>

        <fieldset className="mt-4">
          <legend className="text-sm font-medium">Location type</legend>
          <RadioGroup
            name="location-kind"
            options={KIND_OPTIONS.map((option) => ({ ...option }))}
            value={kind}
            onChange={(value) => setKind(value as KindFilter)}
            orientation="horizontal"
            className="mt-2"
          />
        </fieldset>

        <p aria-live="polite" className="mt-4 text-sm text-[var(--icb-text-subtle)]">
          {results.length} {results.length === 1 ? 'location' : 'locations'}
        </p>

        <ul className="mt-4 space-y-4">
          {results.map((location) => (
            <li
              key={location.id}
              className="rounded-[var(--radius-lg)] border border-[var(--icb-border)] bg-[var(--icb-surface)] p-5"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-semibold">{location.name}</h3>
                <span className="shrink-0 text-xs font-semibold tracking-[0.1em] text-[var(--icb-accent-text)] uppercase">
                  {location.kind}
                </span>
              </div>
              <p className="mt-1 text-sm text-[var(--icb-text-muted)]">{location.address}</p>
              <p className="mt-1 text-sm text-[var(--icb-text-muted)]">{location.hours}</p>
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {location.services.map((service) => (
                  <li
                    key={service}
                    className="rounded-full bg-[var(--icb-bg-muted)] px-2.5 py-0.5 text-xs text-[var(--icb-text-muted)]"
                  >
                    {service}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
