import type { LoanApplication, UploadSignature } from '@icb/contracts';
import {
  buildPublicId,
  canonicalUploadParams,
  PDF_MIME_TYPE,
  signUploadParamsSha1,
  uploadEndpoint,
} from '@icb/media';
import { Inject, Injectable } from '@nestjs/common';

import { ConflictError } from '../../common/errors/index.js';
import { CONFIG, type AppConfiguration } from '../../config/configuration.js';
import { newId } from '../../infrastructure/database/identifier.js';
import { ClockService } from '../../simulation/clock/clock.service.js';
import { toLoanApplication } from './infrastructure/loan-application.mapper.js';
import type { LoanApplicationDoc } from './infrastructure/loan-application.schemas.js';
import type {
  AttachLoanDocumentRequest,
  LoanDocumentUploadRequest,
} from './infrastructure/loan-document.requests.js';
import { LoansRepository } from './infrastructure/loans.repository.js';

/** Mirrors the kyc/support minters: the local stand-in has no real credential. */
const LOCAL_API_KEY = 'local';
/** Not a security boundary: the local store is for keyless development only. */
const LOCAL_SIGNING_SECRET = 'icb-local-upload';
const LOCAL_UPLOAD_PATH = '/v1/media/local-upload';
const MILLIS_PER_SECOND = 1000;

/** Documents can be added while the application is still the customer's to amend. */
const ATTACHABLE_STATUSES: readonly string[] = ['submitted', 'under_review'];

/**
 * Supporting documents for a loan application.
 *
 * Mirrors the KYC flow: the API mints a short-lived signature, the browser posts the bytes
 * straight to the storage provider, and a separate call attaches the resulting asset ref to
 * the application. The bytes never transit the API. Ownership is enforced by the repository
 * query on both steps — the application id in the path grants nothing by itself.
 */
@Injectable()
export class LoanDocumentsService {
  constructor(
    private readonly repository: LoansRepository,
    @Inject(CONFIG) private readonly config: AppConfiguration,
    private readonly clock: ClockService,
  ) {}

  /** Mint the upload grant for one document on an application the customer owns. */
  async mintUploadSignature(
    applicationId: string,
    customerId: string,
    request: LoanDocumentUploadRequest,
  ): Promise<UploadSignature> {
    const application = await this.repository.requireApplication(applicationId, customerId);
    assertAttachable(application);

    const { media } = this.config;
    const timestamp = Math.floor(this.clock.epochMs() / MILLIS_PER_SECOND);
    const folder = `${media.folder}/loans/${applicationId}`;
    const publicId = buildPublicId(request.label, newId());

    return {
      uploadUrl: this.uploadUrl(request.contentType),
      publicId,
      folder,
      timestamp,
      signature: signUploadParamsSha1(
        canonicalUploadParams(folder, publicId, timestamp),
        this.secret(),
      ),
      apiKey: media.enabled ? media.apiKey : LOCAL_API_KEY,
      expiresAt: new Date(
        this.clock.epochMs() + media.signedUrlTtlSeconds * MILLIS_PER_SECOND,
      ).toISOString(),
    };
  }

  /** Attach an uploaded asset to the application. Re-uploads append; nothing is replaced. */
  async attach(
    applicationId: string,
    customerId: string,
    request: AttachLoanDocumentRequest,
  ): Promise<LoanApplication> {
    const application = await this.repository.requireApplication(applicationId, customerId);
    assertAttachable(application);

    await this.repository.applications.updateOne(
      { _id: application._id },
      {
        $push: { documents: { label: request.label, asset: request.asset } },
        $set: { updatedAt: this.clock.now() },
      },
    );

    return toLoanApplication(await this.repository.requireApplication(applicationId, customerId));
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

function assertAttachable(application: LoanApplicationDoc): void {
  if (!ATTACHABLE_STATUSES.includes(application.status)) {
    throw new ConflictError('This application can no longer accept documents', {
      applicationId: application._id,
      status: application.status,
    });
  }
}
