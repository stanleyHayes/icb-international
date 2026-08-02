import type { AssetRef, BankDocument, DownloadLink, UploadSignature } from '@icb/contracts';
import {
  PDF_MIME_TYPE,
  type AssetStore,
  type DocumentKind,
  type MintUploadInput,
} from '@icb/media';
import { Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { ConflictError, NotFoundError } from '../../common/errors/index.js';
import { CONFIG, type AppConfiguration } from '../../config/configuration.js';
import { newId } from '../../infrastructure/database/identifier.js';
import { ClockService } from '../../simulation/clock/clock.service.js';
import type { DocumentBranding } from './domain/pdf-layout.js';
import { ASSET_STORE } from './infrastructure/asset-store.provider.js';
import { BankDocumentDoc } from './infrastructure/document.schemas.js';

/** A rendered document on its way into the archive. */
export interface ArchiveInput {
  customerId: string;
  kind: BankDocument['kind'];
  title: string;
  accountId: string | null;
  /** Folder scope for the asset — the account it belongs to, or the customer. */
  ownerId: string;
  /** Media folder convention the asset is filed under. */
  folder: DocumentKind;
  filename: string;
  bytes: Buffer;
}

/**
 * The document archive.
 *
 * Everything the bank issues to a customer lands here: it owns the `documents` collection, the
 * asset store, and the minting of download links. Keeping those three together means there is
 * exactly one place that can put bytes in front of a customer, and it always does so through a
 * signed link that expires — no handler anywhere can accidentally hand out a durable URL.
 */
@Injectable()
export class DocumentArchiveService {
  constructor(
    @InjectModel(BankDocumentDoc.name) private readonly documents: Model<BankDocumentDoc>,
    @Inject(ASSET_STORE) private readonly assets: AssetStore,
    @Inject(CONFIG) private readonly config: AppConfiguration,
    private readonly clock: ClockService,
  ) {}

  /** Institution details every rendered document carries on its letterhead. */
  get branding(): DocumentBranding {
    return {
      bankName: this.config.bank.name,
      bic: this.config.bank.bic,
      sortCode: this.config.bank.sortCode,
      country: this.config.bank.country,
    };
  }

  /** Uploads the rendered bytes, then records the document that points at them. */
  async store(input: ArchiveInput): Promise<BankDocumentDoc> {
    const asset = await this.assets.upload({
      kind: input.folder,
      ownerId: input.ownerId,
      contentType: PDF_MIME_TYPE,
      bytes: input.bytes,
      label: input.title,
      originalFilename: input.filename,
    });

    const [created] = await this.documents.create([
      {
        _id: newId(),
        customerId: input.customerId,
        kind: input.kind,
        title: input.title,
        accountId: input.accountId,
        asset,
        sizeBytes: input.bytes.byteLength,
        createdAt: this.clock.now(),
      },
    ]);

    if (!created) {
      throw new ConflictError('The document could not be filed', { title: input.title });
    }
    return created;
  }

  async listForCustomer(customerId: string): Promise<BankDocumentDoc[]> {
    return this.documents.find({ customerId }).sort({ createdAt: -1, _id: -1 }).lean();
  }

  /** Ownership is enforced by the query, so one customer cannot name another's document. */
  async requireForCustomer(documentId: string, customerId: string): Promise<BankDocumentDoc> {
    const document = await this.documents.findOne({ _id: documentId, customerId }).lean();
    if (!document) {
      throw new NotFoundError('Document', documentId);
    }
    return document;
  }

  /**
   * Mints a signed link valid for the configured window. Nothing is persisted: the next request
   * gets a new link, and a link that leaks stops working on its own.
   */
  downloadLink(asset: AssetRef, filename: string): DownloadLink {
    const delivery = this.assets.buildSignedUrl(asset, this.config.media.signedUrlTtlSeconds, {
      download: true,
    });
    return { url: delivery.url, expiresAt: delivery.expiresAt, filename };
  }

  /** A grant the browser uses to upload straight to the provider; bytes never reach the API. */
  uploadSignature(input: MintUploadInput): UploadSignature {
    return this.assets.mintUploadSignature(input);
  }

  /** Removes both the asset and its record — used when a render is superseded. */
  async discard(document: BankDocumentDoc): Promise<void> {
    await this.assets.destroy(document.asset);
    await this.documents.deleteOne({ _id: document._id });
  }
}
