import {
  documentUploadRequestSchema,
  issueLetterRequestSchema,
  type BankDocument,
  type DocumentUploadRequest,
  type DownloadLink,
  type IssueLetterRequest,
  type UploadSignature,
} from '@icb/contracts';
import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import { CurrentCustomer } from '../../common/decorators/current-user.decorator.js';
import { zodBody } from '../../common/pipes/zod-validation.pipe.js';
import { DocumentsService } from './documents.service.js';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get()
  async list(@CurrentCustomer() customerId: string): Promise<{ items: BankDocument[] }> {
    return { items: await this.documents.list(customerId) };
  }

  @Get(':documentId/download')
  async download(
    @CurrentCustomer() customerId: string,
    @Param('documentId') documentId: string,
  ): Promise<DownloadLink> {
    return this.documents.downloadLink(customerId, documentId);
  }

  /**
   * A direct-upload grant. The bytes go from the browser to the provider without passing
   * through the API, and the grant is scoped to the authenticated customer's own folder.
   */
  @Post('upload-signature')
  uploadSignature(
    @CurrentCustomer() customerId: string,
    @Body(zodBody(documentUploadRequestSchema)) body: DocumentUploadRequest,
  ): UploadSignature {
    return this.documents.uploadSignature(customerId, body);
  }

  /** Balance confirmations and banker's references, rendered and filed on request. */
  @Post('letters')
  async issueLetter(
    @CurrentCustomer() customerId: string,
    @Body(zodBody(issueLetterRequestSchema)) body: IssueLetterRequest,
  ): Promise<BankDocument> {
    return this.documents.issueLetter(customerId, body);
  }
}
