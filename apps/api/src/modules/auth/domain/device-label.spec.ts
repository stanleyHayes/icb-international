import { describe, expect, it } from 'vitest';

import { describeDevice, parseUserAgent } from './device-label.js';

const CHROME_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const SAFARI_IOS =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

describe('parseUserAgent', () => {
  it('names the browser and platform separately', () => {
    expect(parseUserAgent(CHROME_MAC)).toEqual({
      label: 'Chrome on macOS',
      browser: 'Chrome',
      os: 'macOS',
    });
  });

  it('recognises mobile Safari', () => {
    const parsed = parseUserAgent(SAFARI_IOS);
    expect(parsed.browser).toBe('Safari');
    expect(parsed.os).toBe('iOS');
  });

  it('distinguishes Edge from Chrome (Edge UA contains both tokens)', () => {
    expect(parseUserAgent(`${CHROME_MAC} Edg/126.0.0.0`).browser).toBe('Edge');
  });

  it('returns nulls for unrecognised agents while keeping a readable label', () => {
    const parsed = parseUserAgent('curl/8.0');
    expect(parsed.browser).toBeNull();
    expect(parsed.os).toBeNull();
    expect(parsed.label).toBe('Browser on Unknown device');
  });
});

describe('describeDevice', () => {
  it('is the label half of the parse', () => {
    expect(describeDevice(CHROME_MAC)).toBe('Chrome on macOS');
  });
});
