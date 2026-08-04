import { createReadStream, type ReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join } from 'node:path';

import { LocalAssetStore, MIME_TYPE_EXTENSIONS, type AssetStore } from '@icb/media';
import { Inject, Injectable } from '@nestjs/common';

import { ForbiddenError, NotFoundError, ValidationError } from '../../../common/errors/index.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import {
  ASSET_STORE,
  localStorageRootDir,
} from '../../documents/infrastructure/asset-store.provider.js';

/** Injection token for the directory the local store persists uploads under. */
export const LOCAL_MEDIA_ROOT = Symbol('ICB_LOCAL_MEDIA_ROOT');

export const localMediaRootProvider = {
  provide: LOCAL_MEDIA_ROOT,
  useFactory: (): string => localStorageRootDir(),
};

/** An opened local asset: the byte stream plus what the response headers need. */
export interface LocalDeliveryFile {
  readonly stream: ReadStream;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly filename: string;
}

const MILLIS_PER_SECOND = 1000;
const FALLBACK_CONTENT_TYPE = 'application/octet-stream';
/** Mirrors the store's own path rule: a signed link only ever names slugs and slashes. */
const SAFE_PATH_SEGMENT = /^[a-z0-9][a-z0-9_-]*$/i;
/** The final segment additionally carries the file extension (`statement-a1b2.pdf`). */
const SAFE_FILE_SEGMENT = /^[a-z0-9][a-z0-9_-]*(\.[a-z0-9]+)?$/i;

/** Extension → MIME, the reverse of the store's persist-time mapping. */
const CONTENT_TYPE_BY_EXTENSION: ReadonlyMap<string, string> = new Map(
  Object.entries(MIME_TYPE_EXTENSIONS).map(([mimeType, extension]) => [`.${extension}`, mimeType]),
);

/**
 * Serves the files `LocalAssetStore.buildSignedUrl` mints links to.
 *
 * The link is the credential: the HMAC over `path.exp` is recomputed and compared, and `exp`
 * is checked against the simulation clock — the same clock the store signed with, so a link
 * minted in simulated January dies on its simulated schedule. With real storage credentials
 * configured the provider answers delivery itself and this endpoint does not exist, exactly
 * like the local upload one.
 */
@Injectable()
export class LocalDeliveryService {
  constructor(
    @Inject(ASSET_STORE) private readonly assets: AssetStore,
    @Inject(LOCAL_MEDIA_ROOT) private readonly rootDir: string,
    private readonly clock: ClockService,
  ) {}

  async open(path: string, exp: number, signature: string): Promise<LocalDeliveryFile> {
    const store = this.localStore();
    this.assertSafePath(path);
    this.assertLinkLive(store, path, exp, signature);

    const absolute = join(this.rootDir, path);
    const info = await stat(absolute).catch(() => null);
    if (!info?.isFile()) {
      throw new NotFoundError('Asset', path);
    }

    return {
      stream: createReadStream(absolute),
      contentType: CONTENT_TYPE_BY_EXTENSION.get(extname(path)) ?? FALLBACK_CONTENT_TYPE,
      sizeBytes: info.size,
      filename: path.split('/').at(-1) ?? 'asset',
    };
  }

  /** This endpoint only exists in the local configuration — with credentials, the provider answers. */
  private localStore(): LocalAssetStore {
    if (!(this.assets instanceof LocalAssetStore)) {
      throw new NotFoundError('Endpoint', '/v1/media/delivery');
    }
    return this.assets;
  }

  /** A valid HMAC only ever covers safe paths, but the check costs nothing and bounds the join. */
  private assertSafePath(path: string): void {
    const segments = path.split('/');
    const safe = segments.every((segment, index) =>
      index === segments.length - 1 ? SAFE_FILE_SEGMENT.test(segment) : SAFE_PATH_SEGMENT.test(segment),
    );
    if (!safe) {
      throw new ValidationError('The delivery path is not a stored asset', [
        { path: 'path', message: 'Unexpected path segment' },
      ]);
    }
  }

  /** Expiry first, then the signature — a dead link and a forged one are both simply refused. */
  private assertLinkLive(
    store: LocalAssetStore,
    path: string,
    exp: number,
    signature: string,
  ): void {
    if (!Number.isFinite(exp) || exp * MILLIS_PER_SECOND <= this.clock.epochMs()) {
      throw new ForbiddenError('This delivery link has expired. Mint a new one and retry.');
    }
    if (!store.verifyDeliverySignature(path, exp, signature)) {
      throw new ForbiddenError('The delivery link signature does not match its parameters');
    }
  }
}
