/**
 * A readable device label for the session list.
 *
 * Table-driven rather than a chain of conditionals: the customer sees "Chrome on macOS" next to
 * an IP and a last-seen time, and needs to recognise their own devices at a glance in order to
 * spot one that is not theirs.
 */
const PLATFORMS: readonly [RegExp, string][] = [
  [/iPhone|iPad|iPod/, 'iOS'],
  [/Android/, 'Android'],
  [/Macintosh|Mac OS X/, 'macOS'],
  [/Windows/, 'Windows'],
  [/CrOS/, 'ChromeOS'],
  [/Linux/, 'Linux'],
];

const BROWSERS: readonly [RegExp, string][] = [
  [/Edg\//, 'Edge'],
  [/OPR\/|Opera/, 'Opera'],
  [/Chrome\//, 'Chrome'],
  [/Firefox\//, 'Firefox'],
  [/Safari\//, 'Safari'],
];

export interface ParsedUserAgent {
  /** Always present, e.g. "Chrome on macOS" — falls back to generic words. */
  readonly label: string;
  /** Null when no known browser matched, per the session contract. */
  readonly browser: string | null;
  /** Null when no known platform matched, per the session contract. */
  readonly os: string | null;
}

function matchFirst(table: readonly [RegExp, string][], value: string): string | null {
  return table.find(([pattern]) => pattern.test(value))?.[1] ?? null;
}

export function parseUserAgent(userAgent: string): ParsedUserAgent {
  const os = matchFirst(PLATFORMS, userAgent);
  const browser = matchFirst(BROWSERS, userAgent);
  return {
    label: `${browser ?? 'Browser'} on ${os ?? 'Unknown device'}`,
    browser,
    os,
  };
}

export function describeDevice(userAgent: string): string {
  return parseUserAgent(userAgent).label;
}
