import type { Document as MongoDocument } from 'mongodb';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { newId } from '../../src/infrastructure/database/identifier.js';
import { bootSecurityApp, SKIP_MESSAGE, type SecurityTestApp } from './harness/app-harness.js';
import { seedCustomer, type TestIdentity } from './harness/identities.js';
import { seedFundedAccounts, type SeededResources } from './harness/resources.js';
import { seedBill, seedLoan, seedLoanApplication, seedSavingsGoal, seedTermDeposit } from './harness/seed-credit.js';
import { seedCard, seedStandingOrder, seedTransfer, seedTransferTemplate } from './harness/seed-money.js';
import { seedBeneficiary, seedDispute, seedDocument, seedStatement, seedTicket, seedTransactionExport } from './harness/seed-records.js';

type Method = 'get' | 'post' | 'patch' | 'delete';
type Body = Record<string, unknown>;

const money = (minorUnits: number): Body => ({ minorUnits, currency: 'GHS', scale: 2 });

/** One row = one :id-parameterised route customer B must never reach through. */
interface Probe {
  readonly group: string;
  readonly name: string;
  readonly method: Method;
  readonly path: (r: SeededResources) => string;
  readonly body?: (r: SeededResources) => Body;
  readonly idem?: boolean;
}

const PROBES: readonly Probe[] = [
  { group: 'accounts', name: 'read account', method: 'get', path: (r) => `/v1/accounts/${r.accountId}` },
  { group: 'accounts', name: 'update account', method: 'patch', path: (r) => `/v1/accounts/${r.accountId}`, body: () => ({ nickname: 'hijacked' }) },
  { group: 'accounts', name: 'close account', method: 'post', path: (r) => `/v1/accounts/${r.accountId}/close`, body: () => ({ reason: 'Attacker closing' }), idem: true },
  { group: 'accounts', name: 'read balances', method: 'get', path: (r) => `/v1/accounts/${r.accountId}/balances` },
  { group: 'accounts', name: 'read balance history', method: 'get', path: (r) => `/v1/accounts/${r.accountId}/balance-history` },
  { group: 'accounts', name: 'read holds', method: 'get', path: (r) => `/v1/accounts/${r.accountId}/holds` },
  { group: 'transactions', name: 'read transaction', method: 'get', path: (r) => `/v1/transactions/${r.transactionId}` },
  { group: 'transactions', name: 'annotate transaction', method: 'patch', path: (r) => `/v1/transactions/${r.transactionId}`, body: () => ({ note: 'attacker note' }) },
  { group: 'transactions', name: 'read receipt', method: 'get', path: (r) => `/v1/transactions/${r.transactionId}/receipt` },
  { group: 'transactions', name: 'download export', method: 'get', path: (r) => `/v1/transactions/exports/${r.exportId}/download` },
  { group: 'transfers', name: 'read transfer', method: 'get', path: (r) => `/v1/transfers/${r.transferId}` },
  { group: 'transfers', name: 'cancel transfer', method: 'post', path: (r) => `/v1/transfers/${r.transferId}/cancel`, body: () => ({}), idem: true },
  { group: 'transfers', name: 'delete template', method: 'delete', path: (r) => `/v1/transfer-templates/${r.templateId}` },
  { group: 'transfers', name: 'cancel standing order', method: 'post', path: (r) => `/v1/standing-orders/${r.standingOrderId}/cancel` },
  { group: 'cards', name: 'read card', method: 'get', path: (r) => `/v1/cards/${r.cardId}` },
  { group: 'cards', name: 'update card', method: 'patch', path: (r) => `/v1/cards/${r.cardId}`, body: () => ({ nickname: 'hijacked' }) },
  { group: 'cards', name: 'activate card', method: 'post', path: (r) => `/v1/cards/${r.cardId}/activate` },
  { group: 'cards', name: 'freeze card', method: 'post', path: (r) => `/v1/cards/${r.cardId}/freeze`, body: () => ({ frozen: true }) },
  { group: 'cards', name: 'cancel card', method: 'post', path: (r) => `/v1/cards/${r.cardId}/cancel`, body: () => ({ reason: 'attacker' }) },
  { group: 'cards', name: 'report card', method: 'post', path: (r) => `/v1/cards/${r.cardId}/report`, body: () => ({ reason: 'lost', reissue: false }) },
  { group: 'cards', name: 'set controls', method: 'patch', path: (r) => `/v1/cards/${r.cardId}/controls`, body: () => ({ channels: { online: true, contactless: true, atm: false, international: false, in_store: true } }) },
  { group: 'cards', name: 'set limits', method: 'patch', path: (r) => `/v1/cards/${r.cardId}/limits`, body: () => ({ daily: money(9_000_000) }) },
  { group: 'cards', name: 'set pin', method: 'post', path: (r) => `/v1/cards/${r.cardId}/pin`, body: () => ({ pin: '9876' }) },
  { group: 'cards', name: 'travel notice', method: 'post', path: (r) => `/v1/cards/${r.cardId}/travel-notice`, body: () => ({ countries: ['US'], from: '2024-02-01', to: '2024-02-10' }) },
  { group: 'cards', name: 'read authorisations', method: 'get', path: (r) => `/v1/cards/${r.cardId}/authorisations` },
  { group: 'loans', name: 'read loan', method: 'get', path: (r) => `/v1/loans/${r.loanId}` },
  { group: 'loans', name: 'payoff quote', method: 'get', path: (r) => `/v1/loans/${r.loanId}/payoff-quote` },
  { group: 'loans', name: 'make repayment', method: 'post', path: (r) => `/v1/loans/${r.loanId}/repayments`, body: (r) => ({ fromAccountId: r.accountId, amount: money(44_500), kind: 'scheduled' }), idem: true },
  { group: 'loans', name: 'read application', method: 'get', path: (r) => `/v1/loans/applications/${r.applicationId}` },
  { group: 'loans', name: 'accept application', method: 'post', path: (r) => `/v1/loans/applications/${r.applicationId}/accept` },
  { group: 'savings', name: 'read goal', method: 'get', path: (r) => `/v1/savings/goals/${r.goalId}` },
  { group: 'savings', name: 'update goal', method: 'patch', path: (r) => `/v1/savings/goals/${r.goalId}`, body: () => ({ name: 'hijacked' }) },
  { group: 'savings', name: 'delete goal', method: 'delete', path: (r) => `/v1/savings/goals/${r.goalId}` },
  { group: 'savings', name: 'contribute to goal', method: 'post', path: (r) => `/v1/savings/goals/${r.goalId}/contribute`, body: (r) => ({ fromAccountId: r.accountId, amount: money(1_000) }), idem: true },
  { group: 'savings', name: 'read deposit', method: 'get', path: (r) => `/v1/savings/deposits/${r.depositId}` },
  { group: 'savings', name: 'update deposit', method: 'patch', path: (r) => `/v1/savings/deposits/${r.depositId}`, body: () => ({ maturityInstruction: 'rollover_all' }) },
  { group: 'savings', name: 'break quote', method: 'get', path: (r) => `/v1/savings/deposits/${r.depositId}/break-quote` },
  { group: 'savings', name: 'break deposit', method: 'post', path: (r) => `/v1/savings/deposits/${r.depositId}/break`, idem: true },
  { group: 'bills', name: 'read bill', method: 'get', path: (r) => `/v1/bills/${r.billId}` },
  { group: 'bills', name: 'unlink bill', method: 'delete', path: (r) => `/v1/bills/${r.billId}` },
  { group: 'bills', name: 'set autopay', method: 'patch', path: (r) => `/v1/bills/${r.billId}/autopay`, body: (r) => ({ enabled: true, fromAccountId: r.accountId, strategy: 'full_balance', daysBeforeDue: 2 }) },
  { group: 'bills', name: 'pay bill', method: 'post', path: (r) => `/v1/bills/${r.billId}/pay`, body: (r) => ({ billId: r.billId, fromAccountId: r.accountId, amount: money(42_000) }), idem: true },
  { group: 'bills', name: 'read payment', method: 'get', path: (r) => `/v1/bill-payments/${r.paymentId}` },
  { group: 'bills', name: 'cancel payment', method: 'post', path: (r) => `/v1/bill-payments/${r.paymentId}/cancel` },
  { group: 'documents', name: 'download document', method: 'get', path: (r) => `/v1/documents/${r.documentId}/download` },
  { group: 'documents', name: 'download statement', method: 'get', path: (r) => `/v1/statements/${r.statementId}/download` },
  { group: 'support', name: 'read ticket', method: 'get', path: (r) => `/v1/support/tickets/${r.ticketId}` },
  { group: 'support', name: 'read messages', method: 'get', path: (r) => `/v1/support/tickets/${r.ticketId}/messages` },
  { group: 'support', name: 'post message', method: 'post', path: (r) => `/v1/support/tickets/${r.ticketId}/messages`, body: () => ({ body: 'attacker message' }) },
  { group: 'support', name: 'rate ticket', method: 'post', path: (r) => `/v1/support/tickets/${r.ticketId}/satisfaction`, body: () => ({ rating: 1 }) },
  { group: 'disputes', name: 'read dispute', method: 'get', path: (r) => `/v1/disputes/${r.disputeId}` },
  { group: 'disputes', name: 'attach evidence', method: 'post', path: (r) => `/v1/disputes/${r.disputeId}/evidence`, body: () => ({ evidence: [{ label: 'forged', asset: { provider: 'cloudinary', publicId: 'icb/sec02/forged.png', resourceType: 'image', uploadedAt: '2024-01-02T09:30:00.000Z' } }] }) },
  { group: 'beneficiaries', name: 'read beneficiary', method: 'get', path: (r) => `/v1/beneficiaries/${r.beneficiaryId}` },
  { group: 'beneficiaries', name: 'update beneficiary', method: 'patch', path: (r) => `/v1/beneficiaries/${r.beneficiaryId}`, body: () => ({ nickname: 'hijacked' }) },
  { group: 'beneficiaries', name: 'delete beneficiary', method: 'delete', path: (r) => `/v1/beneficiaries/${r.beneficiaryId}` },
  { group: 'beneficiaries', name: 'start verification', method: 'post', path: (r) => `/v1/beneficiaries/${r.beneficiaryId}/verify/send` },
  { group: 'beneficiaries', name: 'confirm verification', method: 'post', path: (r) => `/v1/beneficiaries/${r.beneficiaryId}/verify/confirm`, body: () => ({ firstAmountMinorUnits: 10, secondAmountMinorUnits: 20 }) },
  { group: 'beneficiaries', name: 'read verification', method: 'get', path: (r) => `/v1/beneficiaries/${r.beneficiaryId}/verify` },
];

describe('SEC-02 IDOR sweep — customer B vs customer A resources', () => {
  let handle: SecurityTestApp | null = null;
  let owner: TestIdentity;
  let attacker: TestIdentity;
  let resources: SeededResources;
  let ownerSessionId: string;

  beforeAll(async () => {
    handle = await bootSecurityApp('idor');
    if (!handle) {
      return;
    }
    owner = await seedCustomer(handle.connection, { email: 'owner@sec02.test', firstName: 'Ada', lastName: 'Owner' });
    attacker = await seedCustomer(handle.connection, { email: 'attacker@sec02.test', firstName: 'Mallory', lastName: 'Attacker' });
    resources = await seedAll(handle, owner.customerId as string);
    ownerSessionId = await seedSession(handle, owner);
  }, 300_000);

  afterAll(async () => {
    await handle?.close();
  });

  /** Narrow the booted handle or skip-with-message — never a false failure on absent infra. */
  function requireApp(context: { skip: (note?: string) => void }): SecurityTestApp {
    if (!handle) {
      context.skip(SKIP_MESSAGE);
      throw new Error(SKIP_MESSAGE);
    }
    return handle;
  }

  for (const probe of PROBES) {
    it(`${probe.group}: B cannot ${probe.name} (never 2xx, always 403/404)`, async (context) => {
      const { app } = requireApp(context);
      const call = request(app.getHttpServer())
        [probe.method](probe.path(resources))
        .set('Authorization', `Bearer ${attacker.accessToken}`);
      if (probe.idem) {
        call.set('Idempotency-Key', `sec02-idor-${probe.group}-${probe.name.replaceAll(' ', '-')}`);
      }
      const response = await call.send(probe.body?.(resources));
      expect(
        [403, 404],
        `IDOR: B got ${response.status} on ${probe.method.toUpperCase()} ${probe.path(resources)} — body: ${JSON.stringify(response.body).slice(0, 300)}`,
      ).toContain(response.status);
    });
  }

  it('B cannot revoke A\'s session, and the session survives the attempt', async (context) => {
    const { app, connection } = requireApp(context);
    const response = await request(app.getHttpServer())
      .delete(`/v1/auth/sessions/${ownerSessionId}`)
      .set('Authorization', `Bearer ${attacker.accessToken}`);
    expect([403, 404]).toContain(response.status);
    const session = await connection
      .collection('sessions')
      .findOne({ _id: ownerSessionId } as unknown as MongoDocument);
    expect(session?.['revokedAt']).toBeNull();
  });

  it('control: owner A reads every seeded resource (proves B\'s 404 is scoping, not absence)', async (context) => {
    const { app } = requireApp(context);
    const getPaths = PROBES.filter((p) => p.method === 'get').map((p) => `${p.group}: ${p.name}|${p.path(resources)}`);
    const server = app.getHttpServer();
    for (const entry of getPaths) {
      const [label, path] = entry.split('|') as [string, string];
      const response = await request(server).get(path).set('Authorization', `Bearer ${owner.accessToken}`);
      expect(response.status, `owner control failed for ${label} (${path}): ${JSON.stringify(response.body).slice(0, 300)}`).toBe(200);
    }
  });
});

async function seedAll(handle: SecurityTestApp, customerId: string): Promise<SeededResources> {
  const { connection } = handle;
  const funded = await seedFundedAccounts(handle.app, customerId);
  const ctx = { customerId, accountId: funded.accountId, secondAccountId: funded.secondAccountId };
  const applicationId = await seedLoanApplication(connection, ctx);
  const { billId, paymentId } = await seedBill(connection, ctx);
  const recordsCtx = { customerId, customerName: 'Ada Owner', userId: customerId, accountId: funded.accountId, transactionId: funded.transactionId };
  return {
    ...funded,
    transferId: await seedTransfer(connection, ctx),
    templateId: await seedTransferTemplate(connection, ctx),
    standingOrderId: await seedStandingOrder(connection, ctx),
    cardId: await seedCard(connection, ctx),
    loanId: await seedLoan(connection, ctx, applicationId),
    applicationId,
    goalId: await seedSavingsGoal(connection, ctx),
    depositId: await seedTermDeposit(connection, ctx),
    billId,
    paymentId,
    statementId: await seedStatement(connection, recordsCtx),
    documentId: await seedDocument(connection, recordsCtx),
    ticketId: await seedTicket(connection, recordsCtx),
    disputeId: await seedDispute(connection, recordsCtx),
    beneficiaryId: await seedBeneficiary(connection, recordsCtx),
    exportId: await seedTransactionExport(connection, recordsCtx),
  };
}

async function seedSession(handle: SecurityTestApp, owner: TestIdentity): Promise<string> {
  const sessionId = newId();
  await handle.connection.collection('sessions').insertOne({
    _id: sessionId,
    userId: owner.userId,
    familyId: newId(),
    tokenHash: 'sec02-session-not-a-real-hash',
    device: {},
    ipAddress: '127.0.0.1',
    trusted: false,
    lastSeenAt: new Date('2024-01-02T09:30:00.000Z'),
    expiresAt: new Date('2099-01-01T00:00:00.000Z'),
    revokedAt: null,
    revokedReason: null,
  } as unknown as MongoDocument);
  return sessionId;
}
