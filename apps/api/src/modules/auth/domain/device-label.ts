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

function matchFirst(table: readonly [RegExp, string][], value: string, fallback: string): string {
  return table.find(([pattern]) => pattern.test(value))?.[1] ?? fallback;
}

export function describeDevice(userAgent: string): string {
  const platform = matchFirst(PLATFORMS, userAgent, 'Unknown device');
  const browser = matchFirst(BROWSERS, userAgent, 'Browser');
  return `${browser} on ${platform}`;
}
