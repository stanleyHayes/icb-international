import { describe, expect, it } from 'vitest';

import { API_VERSION_PREFIX, resolveApiBaseUrl } from '../common/api-url.js';

const FALLBACK = 'http://localhost:4100/v1';

describe('resolveApiBaseUrl', () => {
  it('appends the version prefix to a bare origin', () => {
    expect(resolveApiBaseUrl('https://api.icb.example', FALLBACK)).toBe(
      'https://api.icb.example/v1',
    );
  });

  it('leaves a base that already carries the prefix alone', () => {
    expect(resolveApiBaseUrl('https://api.icb.example/v1', FALLBACK)).toBe(
      'https://api.icb.example/v1',
    );
  });

  it('strips trailing slashes before deciding', () => {
    expect(resolveApiBaseUrl('https://api.icb.example/', FALLBACK)).toBe(
      'https://api.icb.example/v1',
    );
    expect(resolveApiBaseUrl('https://api.icb.example/v1///', FALLBACK)).toBe(
      'https://api.icb.example/v1',
    );
  });

  it('falls back when the variable is unset, empty or whitespace', () => {
    expect(resolveApiBaseUrl(undefined, FALLBACK)).toBe(FALLBACK);
    expect(resolveApiBaseUrl('', FALLBACK)).toBe(FALLBACK);
    expect(resolveApiBaseUrl('   ', FALLBACK)).toBe(FALLBACK);
  });

  it('normalises a fallback that lacks the prefix', () => {
    expect(resolveApiBaseUrl(undefined, 'http://localhost:4100')).toBe('http://localhost:4100/v1');
  });

  it('is idempotent', () => {
    const once = resolveApiBaseUrl('https://api.icb.example', FALLBACK);
    expect(resolveApiBaseUrl(once, FALLBACK)).toBe(once);
  });

  it('does not mistake a path merely containing the prefix for a suffix', () => {
    expect(resolveApiBaseUrl('https://api.icb.example/v1/auth', FALLBACK)).toBe(
      'https://api.icb.example/v1/auth/v1',
    );
  });

  it('exports the prefix the API actually mounts on', () => {
    expect(API_VERSION_PREFIX).toBe('/v1');
  });
});
