import { type z } from 'zod';
import {
  documentSchema,
  documentUploadRequestSchema,
  downloadLinkSchema,
  generateStatementRequestSchema,
  issueLetterRequestSchema,
  itemsEnvelopeSchema,
  statementSchema,
  uploadSignatureSchema,
} from '@icb/contracts';

import { get, post, type Requester } from '../endpoint.js';
import { type RequestOptions } from '../http.js';

export const documentsEndpoints = {
  listStatements: get('/statements', itemsEnvelopeSchema(statementSchema)),
  generateStatement: post('/statements/generate', statementSchema, {
    body: generateStatementRequestSchema,
    idempotent: true,
  }),
  getStatementDownloadLink: get('/statements/:statementId/download', downloadLinkSchema),
  list: get('/documents', itemsEnvelopeSchema(documentSchema)),
  getDownloadLink: get('/documents/:documentId/download', downloadLinkSchema),
  createUploadSignature: post('/documents/upload-signature', uploadSignatureSchema, {
    body: documentUploadRequestSchema,
    idempotent: true,
  }),
  issueLetter: post('/documents/letters', documentSchema, {
    body: issueLetterRequestSchema,
    idempotent: true,
  }),
};

export function createDocumentsApi(call: Requester) {
  return {
    listStatements: (options?: RequestOptions) =>
      call(documentsEndpoints.listStatements, { options }),
    generateStatement: (
      body: z.input<typeof generateStatementRequestSchema>,
      options?: RequestOptions,
    ) => call(documentsEndpoints.generateStatement, { body, options }),
    getStatementDownloadLink: (statementId: string, options?: RequestOptions) =>
      call(documentsEndpoints.getStatementDownloadLink, { params: { statementId }, options }),
    list: (options?: RequestOptions) => call(documentsEndpoints.list, { options }),
    getDownloadLink: (documentId: string, options?: RequestOptions) =>
      call(documentsEndpoints.getDownloadLink, { params: { documentId }, options }),
    createUploadSignature: (
      body: z.input<typeof documentUploadRequestSchema>,
      options?: RequestOptions,
    ) => call(documentsEndpoints.createUploadSignature, { body, options }),
    issueLetter: (body: z.input<typeof issueLetterRequestSchema>, options?: RequestOptions) =>
      call(documentsEndpoints.issueLetter, { body, options }),
  };
}

export type DocumentsApi = ReturnType<typeof createDocumentsApi>;
