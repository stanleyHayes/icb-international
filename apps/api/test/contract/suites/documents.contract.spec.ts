import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { BankDocument, Statement } from '@icb/contracts';
import { documentsOperations } from '@icb/contracts/openapi/routes/documents';
import { ContractContext, fillPath, operationOf, requireInfra } from '../contract-context.js';
import { bootContractApp, closeContractApp, type BootResult, type ContractApp } from '../harness.js';

/**
 * Contract suite: documents (statements, the archive, letters, upload grants).
 *
 * The seed files no statements or documents, so every id comes from something the suite just
 * issued through the API — the mutations double as fixtures for the GETs. The statement window
 * is the previous calendar month computed at runtime: always in the past (the API rejects
 * future periods) and always inside the seeded eighteen months of transactions.
 */
describe('contract: documents', () => {
  let boot: BootResult;
  let app: ContractApp | undefined;
  let ctx: ContractContext;

  beforeAll(async () => {
    boot = await bootContractApp();
    if (boot.available) {
      app = boot.app;
      ctx = new ContractContext(app);
    }
  });

  afterAll(async () => {
    if (app && ctx) {
      ctx.assertCovered(documentsOperations);
      await closeContractApp(app);
    }
  });

  it('generateStatement — a valid window returns the declared statement shape', async (t) => {
    requireInfra(t, boot);
    const accountId = await firstAccountId(ctx);
    const res = await ctx.post('/statements/generate', { accountId, ...previousMonth(ctx) });
    ctx.expectContract('generateStatement', res);
  });

  it('listStatements / downloadStatement — the statement just issued lists and downloads', async (t) => {
    requireInfra(t, boot);
    const accountId = await firstAccountId(ctx);
    const generated = await ctx.post('/statements/generate', { accountId, ...previousMonth(ctx) });
    const statement = ctx.expectContract('generateStatement', generated) as Statement;

    ctx.expectContract('listStatements', await ctx.get('/statements'));

    const downloadPath = fillPath(operationOf('downloadStatement').path, {
      statementId: statement.id,
    });
    ctx.expectContract('downloadStatement', await ctx.get(downloadPath));
  });

  it('issueLetter / listDocuments / downloadDocument — an issued letter files and downloads', async (t) => {
    requireInfra(t, boot);
    const accountId = await firstAccountId(ctx);
    const issued = await ctx.post('/documents/letters', { kind: 'balance_letter', accountId });
    const letter = ctx.expectContract('issueLetter', issued) as BankDocument;

    ctx.expectContract('listDocuments', await ctx.get('/documents'));

    const downloadPath = fillPath(operationOf('downloadDocument').path, { documentId: letter.id });
    ctx.expectContract('downloadDocument', await ctx.get(downloadPath));
  });

  it('createDocumentUploadSignature — a valid grant request returns the declared signature', async (t) => {
    requireInfra(t, boot);
    const res = await ctx.post('/documents/upload-signature', {
      purpose: 'kyc',
      filename: 'passport-photo.png',
      contentType: 'image/png',
      sizeBytes: 128 * 1024,
    });
    ctx.expectContract('createDocumentUploadSignature', res);
  });
});

/** The demo customer's first account id, read from the live list — never hard-coded. */
async function firstAccountId(ctx: ContractContext): Promise<string> {
  const list = await ctx.get('/accounts');
  const ids = idsFromList(list.body as unknown, 'listAccounts');
  expect(ids.length).toBeGreaterThan(0);
  return ids[0] as string;
}

/** The previous calendar month as an ISO window — always past, always inside seeded history. */
function previousMonth(ctx: ContractContext): { from: string; to: string } {
  const now = ctx.now();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
  return { from: isoDate(from), to: isoDate(to) };
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** List responses are either a bare array or an `{ items }` envelope; read ids from whichever. */
function idsFromList(body: unknown, operationId: string): string[] {
  const items = Array.isArray(body)
    ? body
    : (body as { items?: unknown[] } | null)?.items;
  if (!Array.isArray(items)) {
    throw new Error(`${operationId} returned neither an array nor an items envelope.`);
  }
  return items.map((item) => (item as { id: string }).id);
}
