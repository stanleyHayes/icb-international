import { fromMinorUnits } from '@icb/money';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { Document as MongoDocument } from 'mongodb';
import type { Connection } from 'mongoose';

import { newId } from '../../../src/infrastructure/database/identifier.js';
import { AccountsService } from '../../../src/modules/accounts/accounts.service.js';
import { customerRef, glRef } from '../../../src/modules/ledger/domain/account-ref.js';
import { GL_CASH } from '../../../src/modules/ledger/domain/chart-of-accounts.js';
import { LedgerService } from '../../../src/modules/ledger/ledger.service.js';

/** Opening balance for seeded accounts: 50,000.00 in minor units. */
export const FUNDING_MINOR_UNITS = 5_000_000;
export const CURRENCY = 'GHS' as const;

/** Every resource the IDOR sweep points customer B's probes at. */
export interface SeededResources {
  readonly accountId: string;
  readonly secondAccountId: string;
  readonly transactionId: string;
  readonly transferId: string;
  readonly templateId: string;
  readonly standingOrderId: string;
  readonly cardId: string;
  readonly loanId: string;
  readonly applicationId: string;
  readonly goalId: string;
  readonly depositId: string;
  readonly billId: string;
  readonly paymentId: string;
  readonly statementId: string;
  readonly documentId: string;
  readonly ticketId: string;
  readonly disputeId: string;
  readonly beneficiaryId: string;
  readonly exportId: string;
}

/**
 * Open and fund two real accounts for the customer through the application's own services —
 * the only honest way to get ledger-consistent balances — and return the funding transaction's
 * id for the transactions sweep.
 */
export async function seedFundedAccounts(
  app: NestFastifyApplication,
  customerId: string,
): Promise<{ accountId: string; secondAccountId: string; transactionId: string }> {
  const accounts = app.get(AccountsService);
  const ledger = app.get(LedgerService);
  const entropy = deterministicEntropy();

  const first = await accounts.open(accountCommand(customerId, 'Everyday Current', entropy));
  const second = await accounts.open(accountCommand(customerId, 'Second Current', entropy));

  const posted = await ledger.post({
    type: 'deposit',
    description: 'SEC-02 seed funding',
    actor: { kind: 'system', id: null, label: 'sec02' },
    lines: [
      { accountRef: glRef(GL_CASH), direction: 'debit', amount: fromMinorUnits(FUNDING_MINOR_UNITS, CURRENCY) },
      { accountRef: customerRef(first.id), direction: 'credit', amount: fromMinorUnits(FUNDING_MINOR_UNITS, CURRENCY) },
    ],
  });
  await ledger.post({
    type: 'deposit',
    description: 'SEC-02 seed funding (second account)',
    actor: { kind: 'system', id: null, label: 'sec02' },
    lines: [
      { accountRef: glRef(GL_CASH), direction: 'debit', amount: fromMinorUnits(FUNDING_MINOR_UNITS, CURRENCY) },
      { accountRef: customerRef(second.id), direction: 'credit', amount: fromMinorUnits(FUNDING_MINOR_UNITS, CURRENCY) },
    ],
  });
  return { accountId: first.id, secondAccountId: second.id, transactionId: posted.id };
}

function accountCommand(customerId: string, productName: string, entropy: () => number) {
  return {
    customerId,
    productCode: 'ICB-CURRENT',
    productName,
    kind: 'current',
    currency: CURRENCY,
    entropy,
  };
}

/**
 * `AccountsService.open` draws account numbers from this instead of `Math.random`. The coprime
 * step spreads consecutive draws across the digit range — a naive `tick/1000` floors to the
 * same digit for every draw and every account number collides.
 */
function deterministicEntropy(): () => number {
  let tick = 0;
  return () => {
    tick += 1;
    return ((tick * 7919) % 1000) / 1000;
  };
}

/** Insert a raw document; ids are app-shaped ULIDs so paths validate like production traffic. */
export async function insertDoc(
  connection: Connection,
  collection: string,
  doc: Record<string, unknown>,
): Promise<string> {
  const id = newId();
  // The app uses string ULIDs for _id throughout; the driver's default generic types _id as
  // ObjectId, so the insert is stated as a plain mongo Document.
  const record: MongoDocument = { _id: id, ...doc };
  await connection.collection(collection).insertOne(record);
  return id;
}
