import type { BankDocument, Statement } from '@icb/contracts';

import { toMoneyDto } from '../../accounts/infrastructure/account.mapper.js';
import type { BankDocumentDoc, StatementDoc } from './document.schemas.js';

/**
 * Persistence → contract.
 *
 * The stored minor units become `Money` here and nowhere else, so a caller can never accidentally
 * serialise a bare integer and lose the currency alongside it.
 */

export function toStatement(document: StatementDoc): Statement {
  const money = (minorUnits: number) => toMoneyDto(minorUnits, document.currency);

  return {
    id: document._id,
    accountId: document.accountId,
    accountLabel: document.accountLabel,
    period: document.period,
    from: document.from,
    to: document.to,
    openingBalance: money(document.openingMinorUnits),
    closingBalance: money(document.closingMinorUnits),
    totalCredits: money(document.totalCreditsMinorUnits),
    totalDebits: money(document.totalDebitsMinorUnits),
    transactionCount: document.transactionCount,
    asset: document.asset,
    generatedAt: document.generatedAt.toISOString(),
  };
}

export function toBankDocument(document: BankDocumentDoc): BankDocument {
  return {
    id: document._id,
    kind: document.kind as BankDocument['kind'],
    title: document.title,
    accountId: document.accountId,
    asset: document.asset,
    sizeBytes: document.sizeBytes,
    createdAt: document.createdAt.toISOString(),
  };
}
