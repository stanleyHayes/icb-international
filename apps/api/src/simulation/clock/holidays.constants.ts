/**
 * Bank holidays observed by ICB, as ISO dates.
 *
 * Held as data rather than computed so that a simulated year behaves identically on every run
 * and an operator can see exactly which days settlement will skip.
 */
export const BUSINESS_HOLIDAYS: ReadonlySet<string> = new Set([
  // 2026
  '2026-01-01', // New Year's Day
  '2026-01-07', // Constitution Day
  '2026-03-06', // Independence Day
  '2026-04-03', // Good Friday
  '2026-04-06', // Easter Monday
  '2026-05-01', // May Day
  '2026-05-25', // African Union Day
  '2026-07-01', // Republic Day
  '2026-08-03', // Founders' Day
  '2026-09-21', // Kwame Nkrumah Memorial Day
  '2026-12-05', // Farmers' Day
  '2026-12-25', // Christmas Day
  '2026-12-26', // Boxing Day
  // 2027
  '2027-01-01',
  '2027-01-07',
  '2027-03-06',
  '2027-03-26',
  '2027-03-29',
  '2027-05-01',
  '2027-05-25',
  '2027-07-01',
  '2027-08-02',
  '2027-09-21',
  '2027-12-03',
  '2027-12-25',
  '2027-12-27',
]);
