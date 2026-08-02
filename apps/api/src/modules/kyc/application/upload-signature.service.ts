import type { UploadSignature, UploadSignatureRequest } from '@icb/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';

import { ValidationError } from '../../../common/errors/index.js';
import { CONFIG, type AppConfiguration } from '../../../config/configuration.js';
import { newId } from '../../../infrastructure/database/identifier.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';

/**
 * Signed direct-to-Cloudinary uploads.
 *
 * The bytes of a passport scan never transit the API. The browser posts them straight to the
 * storage provider using a short-lived signature minted here, which means the API never buffers
 * identity documents, never needs a multipart body limit large enough to hold them, and cannot
 * leak them from a log or a crash dump.
 *
 * When no credentials are configured — the default for a local checkout — this mints the same
 * shape against a local upload path instead. It never throws for want of a key: a developer
 * without a Cloudinary account still gets a working KYC flow.
 */

const LOCAL_UPLOAD_PATH = '/v1/media/local-upload';
/** Not a security boundary: the local store accepts anything, this only keeps the shape stable. */
const LOCAL_SIGNING_SECRET = 'icb-local-upload';
const LOCAL_API_KEY = 'local';

@Injectable()
export class UploadSignatureService {
  constructor(
    @Inject(CONFIG) private readonly config: AppConfiguration,
    private readonly clock: ClockService,
  ) {}

  mint(customerId: string, request: UploadSignatureRequest): UploadSignature {
    this.assertSupportedFormat(request);

    const { media } = this.config;
    const timestamp = Math.floor(this.clock.epochMs() / 1000);
    const folder = `${media.folder}/kyc/${customerId}`;
    const publicId = `${request.documentType}-${newId()}`;
    const expiresAt = new Date(this.clock.epochMs() + media.signedUrlTtlSeconds * 1000);

    return {
      uploadUrl: this.uploadUrl(resourceTypeFor(request)),
      publicId,
      folder,
      timestamp,
      signature: this.sign({ folder, publicId, timestamp }),
      apiKey: media.enabled ? media.apiKey : LOCAL_API_KEY,
      expiresAt: expiresAt.toISOString(),
    };
  }

  /**
   * Cloudinary's scheme: the signed parameters, sorted by name, joined as a query string, with
   * the API secret appended, hashed with SHA-1. Reimplemented rather than pulled from the SDK so
   * that nothing in this application depends on a provider's client library.
   */
  private sign(params: Readonly<Record<string, string | number>>): string {
    const canonical = Object.entries(params)
      .map(([key, value]) => `${toSignedName(key)}=${String(value)}`)
      // Byte order, not locale order — the provider sorts on the raw parameter names.
      .sort((left, right) => (left < right ? -1 : 1))
      .join('&');

    // SHA-1 is not a security choice here: it is the algorithm the provider's verification
    // endpoint requires. The signature authenticates an upload slot, not a credential, and the
    // secret never leaves the server.
    // eslint-disable-next-line sonarjs/hashing -- dictated by the provider's signature scheme
    return createHash('sha1').update(`${canonical}${this.signingSecret()}`).digest('hex');
  }

  private signingSecret(): string {
    const secret = this.config.media.apiSecret;
    return secret.length > 0 ? secret : LOCAL_SIGNING_SECRET;
  }

  private uploadUrl(resourceType: string): string {
    const { media, http } = this.config;
    if (media.enabled) {
      return `https://api.cloudinary.com/v1_1/${media.cloudName}/${resourceType}/upload`;
    }
    // 0.0.0.0 is a bind address, not somewhere a browser can post to.
    const host = http.host === '0.0.0.0' ? 'localhost' : http.host;
    return `http://${host}:${String(http.port)}${LOCAL_UPLOAD_PATH}`;
  }

  /** A selfie is a photograph; accepting a PDF there would defeat the liveness check. */
  private assertSupportedFormat(request: UploadSignatureRequest): void {
    if (request.documentType === 'selfie' && request.contentType === 'application/pdf') {
      throw new ValidationError('A selfie must be an image', [
        { path: 'contentType', message: 'Expected image/jpeg, image/png or image/webp' },
      ]);
    }
  }
}

/** PDFs are stored as raw assets; everything else is an image Cloudinary may transform. */
function resourceTypeFor(request: UploadSignatureRequest): string {
  return request.contentType === 'application/pdf' ? 'raw' : 'image';
}

/** `publicId` is `public_id` on the wire; the signature must use the wire name. */
function toSignedName(key: string): string {
  return key === 'publicId' ? 'public_id' : key;
}
