import { z } from 'zod';
import {
  documentSchema,
  downloadLinkSchema,
  generateStatementRequestSchema,
  idSchema,
  statementSchema,
} from '@icb/contracts';

import { get, post, type Requester } from '../endpoint.js';
import { type RequestOptions } from '../http.js';

const statementQuerySchema = z.object({ accountId: idSchema.optional() });

export const documentsEndpoints = {
  listStatements: get('/documents/statements', z.array(statementSchema), {
    query: statementQuerySchema,
  }),
  generateStatement: post('/documents/statements', statementSchema, {
    body: generateStatementRequestSchema,
    idempotent: true,
  }),
  list: get('/documents', z.array(documentSchema)),
  getDownloadLink: get('/documents/:documentId/download', downloadLinkSchema),
};

export function createDocumentsApi(call: Requester) {
  return {
    listStatements: (query?: z.input<typeof statementQuerySchema>, options?: RequestOptions) =>
      call(documentsEndpoints.listStatements, { query, options }),
    generateStatement: (
      body: z.input<typeof generateStatementRequestSchema>,
      options?: RequestOptions,
    ) => call(documentsEndpoints.generateStatement, { body, options }),
    list: (options?: RequestOptions) => call(documentsEndpoints.list, { options }),
    getDownloadLink: (documentId: string, options?: RequestOptions) =>
      call(documentsEndpoints.getDownloadLink, { params: { documentId }, options }),
  };
}

export type DocumentsApi = ReturnType<typeof createDocumentsApi>;
