/** Presentation constants for the controls room. No behaviour lives here. */

export const ADVANCE_PRESETS = [
  { duration: 'PT1H', label: '1 hour' },
  { duration: 'PT6H', label: '6 hours' },
  { duration: 'P1D', label: '1 day' },
  { duration: 'P7D', label: '1 week' },
  { duration: 'P30D', label: '30 days' },
  { duration: 'P90D', label: '90 days' },
] as const;

export const INTENSITIES = [
  { value: 'light', label: 'Light' },
  { value: 'normal', label: 'Normal' },
  { value: 'heavy', label: 'Heavy' },
] as const;

/** The scenario the synthetic-traffic trigger drives: sustained background load. */
export const TRAFFIC_SCENARIO = 'high_load';

/** What an operator must type to arm a database reset. Short, unambiguous, hard to paste idly. */
export const RESET_CONFIRMATION = 'RESET';

export const RAIL_LABELS: Record<string, string> = {
  internal: 'Internal book transfer',
  on_us: 'On-us',
  ach: 'ACH',
  wire: 'Wire',
  swift: 'SWIFT',
  card: 'Card network',
};

export const SCENARIO_LABELS: Record<string, string> = {
  payday: 'Payday',
  month_end: 'Month-end',
  fraud_burst: 'Fraud burst',
  dispute_wave: 'Dispute wave',
  market_volatility: 'Market volatility',
  rail_outage: 'Rail outage',
  high_load: 'High load',
  dormant_reactivation: 'Dormant reactivation',
};

/** Failure rate is stored 0–1; the editor speaks percent. One decimal is enough resolution. */
export function rateToPercent(rate: number): number {
  return Math.round(rate * 1000) / 10;
}

export function percentToRate(percent: number): number {
  return Math.min(1, Math.max(0, percent / 100));
}

function plural(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? '' : 's'}`;
}

/** "+13 days 4 hours ahead of real time", or "running true". */
export function describeOffset(offsetMs: number): string {
  if (offsetMs === 0) return 'running true';
  const ahead = offsetMs > 0;
  const abs = Math.abs(offsetMs);
  const days = Math.floor(abs / 86_400_000);
  const hours = Math.floor((abs % 86_400_000) / 3_600_000);
  const parts = [days > 0 ? plural(days, 'day') : '', hours > 0 ? plural(hours, 'hour') : ''].filter(
    Boolean,
  );
  const magnitude = parts.length > 0 ? parts.join(' ') : 'under an hour';
  return `${magnitude} ${ahead ? 'ahead of' : 'behind'} real time`;
}
