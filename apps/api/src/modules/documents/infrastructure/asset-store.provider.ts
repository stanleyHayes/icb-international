import { join } from 'node:path';

import { LocalAssetStore, createCloudinaryAssetStore, type AssetStore } from '@icb/media';
import type { Provider } from '@nestjs/common';

import { CONFIG, type AppConfiguration } from '../../../config/configuration.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';

/** Injection token for the asset store. Consumers depend on the port, never on a provider. */
export const ASSET_STORE = Symbol('ICB_ASSET_STORE');

const STORAGE_DIRECTORY = 'storage';
const WILDCARD_HOST = '0.0.0.0';

/**
 * The route prefix the local delivery endpoint answers on, under the API's global `v1`
 * prefix. Signed links are minted pointing here; without it they would miss the global
 * prefix and 404.
 */
const LOCAL_DELIVERY_PATH_PREFIX = '/v1/media/delivery';

/**
 * Binds Cloudinary when credentials are configured, and the filesystem store when they are not.
 *
 * Both implement the same port and both produce refs that satisfy `assetRefSchema`, so a
 * checkout with an empty `.env` still generates, stores, and serves real statement PDFs — and
 * pasting credentials in later changes nothing above this file.
 *
 * The store reads time through `ClockService`, so an operator who advances the simulated clock a
 * month sees signature and link expiry move with it rather than against it.
 */
export const assetStoreProvider: Provider = {
  provide: ASSET_STORE,
  inject: [CONFIG, ClockService],
  useFactory: (config: AppConfiguration, clock: ClockService): AssetStore =>
    config.media.enabled ? cloudinaryStore(config, clock) : localStore(config, clock),
};

function cloudinaryStore(config: AppConfiguration, clock: ClockService): AssetStore {
  return createCloudinaryAssetStore(
    {
      cloudName: config.media.cloudName,
      apiKey: config.media.apiKey,
      apiSecret: config.media.apiSecret,
      rootFolder: config.media.folder,
      deliveryUrlTtlSeconds: config.media.signedUrlTtlSeconds,
    },
    { now: () => clock.epochMs() },
  );
}

function localStore(config: AppConfiguration, clock: ClockService): AssetStore {
  return new LocalAssetStore(
    {
      rootDir: localStorageRootDir(),
      baseUrl: localBaseUrl(config),
      rootFolder: config.media.folder,
      deliveryPathPrefix: LOCAL_DELIVERY_PATH_PREFIX,
      deliveryUrlTtlSeconds: config.media.signedUrlTtlSeconds,
    },
    { now: () => clock.epochMs() },
  );
}

/**
 * Where the local store persists uploads. Exported for the delivery endpoint, which reads the
 * same directory back when a signed link is presented.
 */
export function localStorageRootDir(): string {
  return join(process.cwd(), STORAGE_DIRECTORY);
}

/** A link must be reachable, and nothing can connect to the wildcard bind address. */
function localBaseUrl(config: AppConfiguration): string {
  const host = config.http.host === WILDCARD_HOST ? 'localhost' : config.http.host;
  return `http://${host}:${String(config.http.port)}`;
}
