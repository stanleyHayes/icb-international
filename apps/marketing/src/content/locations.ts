/**
 * Branch and cash-machine locations.
 *
 * Held as data so the locator renders a filterable list and the same records can drive a map
 * later. Coordinates are present in the data even though the current map is a labelled
 * placeholder — the list is the accessible source of truth either way.
 */

export interface Location {
  readonly id: string;
  readonly name: string;
  readonly kind: 'Branch' | 'Cash machine';
  readonly city: string;
  readonly address: string;
  readonly hours: string;
  readonly services: readonly string[];
  readonly position: { readonly lat: number; readonly lng: number };
}

const BRANCH = 'Branch';
const CASH_COUNTER = 'Cash counter';
const CASH_MACHINE = 'Cash machine';

export const LOCATIONS: readonly Location[] = [
  {
    id: 'accra-high-street',
    name: 'Accra High Street',
    kind: BRANCH,
    city: 'Accra',
    address: '14 High Street, Accra',
    hours: 'Mon–Fri 08:30–16:30 · Sat 09:00–13:00',
    services: [CASH_COUNTER, CASH_MACHINE, 'Business desk', 'Accessibility step-free'],
    position: { lat: 5.55, lng: -0.2 },
  },
  {
    id: 'accra-osu',
    name: 'Osu Oxford Street',
    kind: BRANCH,
    city: 'Accra',
    address: '21 Oxford Street, Osu, Accra',
    hours: 'Mon–Fri 09:00–17:00 · Sat 09:00–13:00',
    services: [CASH_MACHINE, 'Card collection', 'Accessibility step-free'],
    position: { lat: 5.556, lng: -0.183 },
  },
  {
    id: 'accra-airport-city',
    name: 'Airport City',
    kind: CASH_MACHINE,
    city: 'Accra',
    address: 'Airport City, Liberation Road, Accra',
    hours: 'Open 24 hours',
    services: [CASH_MACHINE, 'Deposits'],
    position: { lat: 5.604, lng: -0.168 },
  },
  {
    id: 'kumasi-adum',
    name: 'Kumasi Adum',
    kind: BRANCH,
    city: 'Kumasi',
    address: '3 Prempeh II Street, Adum, Kumasi',
    hours: 'Mon–Fri 08:30–16:30 · Sat 09:00–13:00',
    services: [CASH_COUNTER, CASH_MACHINE, 'Business desk'],
    position: { lat: 6.688, lng: -1.624 },
  },
  {
    id: 'kumasi-tech-junction',
    name: 'Tech Junction',
    kind: CASH_MACHINE,
    city: 'Kumasi',
    address: 'Tech Junction, Kumasi',
    hours: 'Open 24 hours',
    services: ['Cash machine'],
    position: { lat: 6.675, lng: -1.571 },
  },
  {
    id: 'takoradi-market-circle',
    name: 'Takoradi Market Circle',
    kind: BRANCH,
    city: 'Takoradi',
    address: '8 Market Circle, Takoradi',
    hours: 'Mon–Fri 08:30–16:30',
    services: [CASH_COUNTER, CASH_MACHINE, 'Trade finance desk'],
    position: { lat: 4.885, lng: -1.755 },
  },
  {
    id: 'tema-community-one',
    name: 'Tema Community One',
    kind: CASH_MACHINE,
    city: 'Tema',
    address: 'Community One, Tema',
    hours: 'Open 24 hours',
    services: [CASH_MACHINE, 'Deposits'],
    position: { lat: 5.64, lng: 0.01 },
  },
  {
    id: 'tamale-central',
    name: 'Tamale Central',
    kind: BRANCH,
    city: 'Tamale',
    address: '12 Daboya Street, Tamale',
    hours: 'Mon–Fri 08:30–16:30',
    services: [CASH_COUNTER, CASH_MACHINE, 'Accessibility step-free'],
    position: { lat: 9.403, lng: -0.842 },
  },
] as const;

/** Distinct cities, in first-appearance order, for the locator's filter. */
export const LOCATION_CITIES: readonly string[] = [
  ...new Set(LOCATIONS.map((location) => location.city)),
];
