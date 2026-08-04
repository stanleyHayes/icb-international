import { join } from 'node:path';

import { LocalAssetStore, type AssetStore } from '@icb/media';
import { describe, expect, it } from 'vitest';

import type { AppConfiguration } from '../../../../config/configuration.js';
import { ClockService } from '../../../../simulation/clock/clock.service.js';
import {
  assetStoreProvider,
  localStorageRootDir,
} from '../asset-store.provider.js';

const NOW = new Date('2026-08-04T10:00:00.000Z');

type Factory = (config: AppConfiguration, clock: ClockService) => AssetStore;

const factory = (assetStoreProvider as unknown as { useFactory: Factory }).useFactory;

function configWith(host: string, mediaEnabled: boolean): AppConfiguration {
  return {
    http: { port: 3001, host, corsOrigins: [] },
    media: {
      cloudName: 'demo-cloud',
      apiKey: 'key',
      apiSecret: 'secret',
      folder: 'icb',
      signedUrlTtlSeconds: 300,
      enabled: mediaEnabled,
    },
    // Only the two branches the factory reads. `as unknown as` rather than `as`: the literal is
    // deliberately partial, and a direct assertion no longer overlaps enough for TypeScript.
  } as unknown as AppConfiguration;
}

function frozenClock(): ClockService {
  const clock = new ClockService();
  clock.freeze(NOW);
  return clock;
}

function baseUrlOf(store: AssetStore): string {
  return (store as unknown as { config: { baseUrl: string } }).config.baseUrl;
}

describe('assetStoreProvider', () => {
  it('binds the filesystem store when no Cloudinary credentials are configured', () => {
    const store = factory(configWith('127.0.0.1', false), frozenClock());

    expect(store).toBeInstanceOf(LocalAssetStore);
    expect(baseUrlOf(store)).toBe('http://127.0.0.1:3001');
  });

  it('rewrites the wildcard bind address to localhost in local delivery links', () => {
    const store = factory(configWith('0.0.0.0', false), frozenClock());

    expect(store).toBeInstanceOf(LocalAssetStore);
    expect(baseUrlOf(store)).toBe('http://localhost:3001');
  });

  it('binds the Cloudinary store when credentials are configured', () => {
    const store = factory(configWith('127.0.0.1', true), frozenClock());

    expect(store).not.toBeInstanceOf(LocalAssetStore);
    expect(typeof store.upload).toBe('function');
  });
});

describe('localStorageRootDir', () => {
  it('points the delivery endpoint at the storage directory under the process cwd', () => {
    expect(localStorageRootDir()).toBe(join(process.cwd(), 'storage'));
  });
});
