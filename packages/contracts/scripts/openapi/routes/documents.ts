import { z } from 'zod';

import {
  documentSchema,
  downloadLinkSchema,
  generateStatementRequestSchema,
  statementSchema,
} from '../../../src/index.js';
import { idSchema } from '../../../src/common/primitives.js';
import { STATUS, TAG } from '../constants.js';
import { defineOperations, success } from '../spec.js';

export const documentsOperations = defineOperations([
  {
    method: 'get',
    path: '/documents/statements',
    tag: TAG.documents,
    operationId: 'listStatements',
    summary: 'Generated statements, optionally per account',
    query: z.object({ accountId: idSchema.optional() }),
    response: success(STATUS.ok, 'Statements, newest period first.', z.array(statementSchema)),
  },
  {
    method: 'post',
    path: '/documents/statements',
    tag: TAG.documents,
    operationId: 'generateStatement',
    summary: 'Generate a statement for an arbitrary period',
    request: generateStatementRequestSchema,
    response: success(STATUS.accepted, 'The generated statement.', statementSchema),
    errors: [{ status: STATUS.unprocessable }],
  },
  {
    method: 'get',
    path: '/documents/statements/{statementId}/download',
    tag: TAG.documents,
    operationId: 'downloadStatement',
    summary: 'A short-lived signed download URL',
    pathParams: { statementId: idSchema },
    response: success(STATUS.ok, 'The signed download link.', downloadLinkSchema),
    errors: [{ status: STATUS.notFound }],
  },
  {
    method: 'get',
    path: '/documents',
    tag: TAG.documents,
    operationId: 'listDocuments',
    summary: 'Tax documents, letters, and contracts',
    response: success(STATUS.ok, 'All documents.', z.array(documentSchema)),
  },
  {
    method: 'get',
    path: '/documents/{documentId}/download',
    tag: TAG.documents,
    operationId: 'downloadDocument',
    summary: 'A short-lived signed download URL',
    pathParams: { documentId: idSchema },
    response: success(STATUS.ok, 'The signed download link.', downloadLinkSchema),
    errors: [{ status: STATUS.notFound }],
  },
]);
