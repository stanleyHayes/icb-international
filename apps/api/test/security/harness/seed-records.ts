import type { Connection } from 'mongoose';

import { FIXED_NOW } from './identities.js';
import { insertDoc, CURRENCY } from './resources.js';

export interface RecordsSeedContext {
  readonly customerId: string;
  readonly customerName: string;
  readonly userId: string;
  readonly accountId: string;
  readonly transactionId: string;
}

export async function seedStatement(connection: Connection, ctx: RecordsSeedContext): Promise<string> {
  return insertDoc(connection, 'statements', {
    customerId: ctx.customerId,
    accountId: ctx.accountId,
    accountLabel: 'Everyday Current',
    period: '2024-01',
    from: '2024-01-01',
    to: '2024-01-31',
    currency: CURRENCY,
    openingMinorUnits: 0,
    closingMinorUnits: 5_000_000,
    totalCreditsMinorUnits: 5_000_000,
    totalDebitsMinorUnits: 0,
    transactionCount: 1,
    asset: {
      provider: 'cloudinary',
      publicId: 'icb/sec02/january-statement.pdf',
      resourceType: 'raw',
      bytes: 1024,
      uploadedAt: FIXED_NOW.toISOString(),
    },
    documentId: null,
    generatedAt: FIXED_NOW,
  });
}

export async function seedDocument(connection: Connection, ctx: RecordsSeedContext): Promise<string> {
  return insertDoc(connection, 'documents', {
    customerId: ctx.customerId,
    kind: 'statement',
    title: 'January 2024 statement',
    accountId: ctx.accountId,
    asset: {
      provider: 'cloudinary',
      publicId: 'icb/sec02/january-statement.pdf',
      resourceType: 'raw',
      bytes: 1024,
      uploadedAt: FIXED_NOW.toISOString(),
    },
    sizeBytes: 1024,
    createdAt: FIXED_NOW,
  });
}

/** An open support ticket with one customer message. */
export async function seedTicket(
  connection: Connection,
  ctx: RecordsSeedContext,
): Promise<string> {
  const ticketId = await insertDoc(connection, 'support_tickets', {
    reference: 'SUP-SEC02A',
    customerId: ctx.customerId,
    customerName: ctx.customerName,
    subject: 'Statement question',
    category: 'account',
    priority: 'normal',
    status: 'open',
    assignedTo: null,
    assignedToName: null,
    messageCount: 1,
    lastMessageAt: FIXED_NOW,
    slaDueAt: null,
    resolvedAt: null,
    closedAt: null,
    satisfaction: null,
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
  });
  await insertDoc(connection, 'support_messages', {
    ticketId,
    customerId: ctx.customerId,
    author: 'customer',
    authorId: ctx.userId,
    authorName: ctx.customerName,
    body: 'Can you explain this entry on my statement?',
    attachments: [],
    sentAt: FIXED_NOW,
  });
  return ticketId;
}

export async function seedDispute(connection: Connection, ctx: RecordsSeedContext): Promise<string> {
  return insertDoc(connection, 'disputes', {
    reference: 'DSP-SEC02A',
    transactionId: ctx.transactionId,
    customerId: ctx.customerId,
    customerName: ctx.customerName,
    accountId: ctx.accountId,
    amountMinorUnits: 10_000,
    currency: CURRENCY,
    reason: 'unauthorised',
    detail: 'I do not recognise this transaction.',
    contactedMerchant: true,
    stage: 'opened',
    outcome: null,
    evidence: [],
    provisionalCredit: null,
    timeline: [{ at: FIXED_NOW, stage: 'opened', note: 'Dispute opened by customer.' }],
    slaDueAt: FIXED_NOW,
    resolvedAt: null,
    assignedTo: null,
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
  });
}

export async function seedBeneficiary(connection: Connection, ctx: RecordsSeedContext): Promise<string> {
  return insertDoc(connection, 'beneficiaries', {
    customerId: ctx.customerId,
    nickname: 'Jane',
    name: 'Jane Mensah',
    destination: { kind: 'domestic_bank', accountNumber: '12345678', sortCode: '04-06-75', accountHolderName: 'Jane Mensah' },
    destinationKey: 'domestic_bank:12345678:04-06-75',
    displayIdentifier: '12345678 · 04-06-75',
    bankName: 'GCB Bank',
    currency: CURRENCY,
    icbAccountId: null,
    verified: true,
    favourite: false,
    coolingOffUntil: FIXED_NOW,
    lastUsedAt: null,
    useCount: 0,
    addedAt: FIXED_NOW,
    verificationState: 'verified',
    verificationAttemptsRemaining: 3,
    verificationHash: null,
    depositsSentAt: null,
    verifiedAt: FIXED_NOW,
    microDepositTransactionIds: [],
  });
}

export async function seedTransactionExport(connection: Connection, ctx: RecordsSeedContext): Promise<string> {
  return insertDoc(connection, 'transaction_exports', {
    customerId: ctx.customerId,
    accountId: ctx.accountId,
    format: 'csv',
    from: '2024-01-01',
    to: '2024-01-31',
    linkExpiresAt: new Date('2099-01-01T00:00:00.000Z'),
  });
}
