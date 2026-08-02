import type {
  BankDocument,
  DocumentUploadRequest,
  DownloadLink,
  IssueLetterRequest,
  UploadSignature,
} from '@icb/contracts';
import { Injectable } from '@nestjs/common';

import { ValidationError } from '../../common/errors/index.js';
import { newReference } from '../../infrastructure/database/identifier.js';
import { ClockService } from '../../simulation/clock/clock.service.js';
import { AccountsService } from '../accounts/accounts.service.js';
import { DocumentArchiveService } from './document-archive.service.js';
import { documentFilename } from './domain/document-text.js';
import {
  balanceConfirmationLetter,
  referenceLetter,
  renderLetterPdf,
  type LetterPdfInput,
} from './domain/letter-pdf.js';
import { CustomerProfileReader } from './infrastructure/customer-profile.reader.js';
import { toBankDocument } from './infrastructure/document.mapper.js';

const LETTER_FOLDER = 'statements';

/**
 * Customer-facing documents: the archive listing, expiring download links, direct-upload
 * grants, and the letters the bank issues on request.
 *
 * Letters are generated on demand rather than stored as templates with placeholders, because
 * the figures they quote — a balance, a relationship start date — are only true at the moment
 * of issue, and the document records which moment that was.
 */
@Injectable()
export class DocumentsService {
  constructor(
    private readonly archive: DocumentArchiveService,
    private readonly profiles: CustomerProfileReader,
    private readonly accounts: AccountsService,
    private readonly clock: ClockService,
  ) {}

  async list(customerId: string): Promise<BankDocument[]> {
    const documents = await this.archive.listForCustomer(customerId);
    return documents.map(toBankDocument);
  }

  async downloadLink(customerId: string, documentId: string): Promise<DownloadLink> {
    const document = await this.archive.requireForCustomer(documentId, customerId);
    return this.archive.downloadLink(document.asset, documentFilename(document.title));
  }

  /**
   * Mints a direct-upload grant scoped to this customer's folder. The allow-lists are applied
   * before the signature exists, so a file the bank would reject never leaves the browser.
   */
  uploadSignature(customerId: string, request: DocumentUploadRequest): UploadSignature {
    return this.archive.uploadSignature({
      kind: request.purpose,
      ownerId: customerId,
      contentType: request.contentType,
      sizeBytes: request.sizeBytes,
      label: request.filename,
    });
  }

  async issueLetter(customerId: string, request: IssueLetterRequest): Promise<BankDocument> {
    const letter =
      request.kind === 'balance_letter'
        ? await this.balanceLetter(customerId, request)
        : await this.bankersReference(customerId, request);

    const stored = await this.archive.store({
      customerId,
      kind: request.kind,
      title: letter.title,
      accountId: request.accountId ?? null,
      ownerId: customerId,
      folder: LETTER_FOLDER,
      filename: documentFilename(`${letter.title} ${letter.reference}`),
      bytes: renderLetterPdf(letter),
    });

    return toBankDocument(stored);
  }

  private async balanceLetter(
    customerId: string,
    request: IssueLetterRequest,
  ): Promise<LetterPdfInput> {
    if (request.accountId === undefined) {
      throw new ValidationError('A balance confirmation must name an account', [
        { path: 'accountId', message: 'Required for a balance confirmation' },
      ]);
    }

    const account = await this.accounts.getForCustomer(request.accountId, customerId);
    const profile = await this.profiles.require(customerId);

    return balanceConfirmationLetter({
      branding: this.archive.branding,
      holderName: profile.displayName,
      addressedTo: request.addressedTo ?? profile.displayName,
      reference: newReference('BAL'),
      productName: account.productName,
      identifiers: account.identifiers,
      currency: account.currency,
      balanceMinorUnits: account.balances.ledger.minorUnits,
      availableMinorUnits: account.balances.available.minorUnits,
      asOf: this.clock.today(),
      generatedAt: this.clock.now(),
    });
  }

  private async bankersReference(
    customerId: string,
    request: IssueLetterRequest,
  ): Promise<LetterPdfInput> {
    const profile = await this.profiles.require(customerId);
    const accounts = await this.accounts.listForCustomer(customerId);

    return referenceLetter({
      branding: this.archive.branding,
      holderName: profile.displayName,
      addressedTo: request.addressedTo ?? 'To whom it may concern',
      reference: newReference('REF'),
      customerSince: profile.memberSince,
      accountCount: accounts.length,
      generatedAt: this.clock.now(),
    });
  }
}
