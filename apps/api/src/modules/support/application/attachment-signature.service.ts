import type { UploadSignature } from '@icb/contracts';
import {
  buildPublicId,
  canonicalUploadParams,
  PDF_MIME_TYPE,
  signUploadParamsSha1,
  uploadEndpoint,
} from '@icb/media';
import { Inject, Injectable } from '@nestjs/common';
import type { z } from 'zod';

import { CONFIG, type AppConfiguration } from '../../../config/configuration.js';
import { newId } from '../../../infrastructure/database/identifier.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import type { attachmentUploadRequestSchema } from '../infrastructure/support-requests.js';
import {
  LOCAL_API_KEY,
  LOCAL_SIGNING_SECRET,
  LOCAL_UPLOAD_PATH,
  MILLIS_PER_SECOND,
} from '../support.constants.js';

export type AttachmentUploadRequest = z.infer<typeof attachmentUploadRequestSchema>;

/**
 * Signed direct-to-storage uploads for message attachments.
 *
 * The bytes of an attachment never transit the API: the browser posts them straight to the
 * storage provider with a short-lived signature minted here. With no credentials configured the
 * same shape is minted against the local upload path, so an offline checkout still runs the
 * full flow. Signature minting only — delivery URLs are the documents module's concern.
 */
@Injectable()
export class AttachmentSignatureService {
  constructor(
    @Inject(CONFIG) private readonly config: AppConfiguration,
    private readonly clock: ClockService,
  ) {}

  mint(customerId: string, request: AttachmentUploadRequest): UploadSignature {
    const { media } = this.config;
    const timestamp = Math.floor(this.clock.epochMs() / MILLIS_PER_SECOND);
    const folder = `${media.folder}/support/${customerId}`;
    const publicId = buildPublicId(request.filename, newId());

    return {
      uploadUrl: this.uploadUrl(request.contentType),
      publicId,
      folder,
      timestamp,
      signature: signUploadParamsSha1(canonicalUploadParams(folder, publicId, timestamp), this.secret()),
      apiKey: media.enabled ? media.apiKey : LOCAL_API_KEY,
      expiresAt: new Date(
        this.clock.epochMs() + media.signedUrlTtlSeconds * MILLIS_PER_SECOND,
      ).toISOString(),
    };
  }

  private secret(): string {
    const secret = this.config.media.apiSecret;
    return secret.length > 0 ? secret : LOCAL_SIGNING_SECRET;
  }

  private uploadUrl(contentType: string): string {
    const { media, http } = this.config;
    if (media.enabled) {
      return uploadEndpoint(media.cloudName, contentType === PDF_MIME_TYPE ? 'raw' : 'image');
    }
    // 0.0.0.0 is a bind address, not somewhere a browser can post to.
    const host = http.host === '0.0.0.0' ? 'localhost' : http.host;
    return `http://${host}:${String(http.port)}${LOCAL_UPLOAD_PATH}`;
  }
}
