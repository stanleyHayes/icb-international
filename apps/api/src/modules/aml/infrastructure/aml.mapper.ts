import type { AlertSeverity, AmlAlert, AmlAlertKind, CaseStatus, MoneyDto } from '@icb/contracts';
import { getScale, type CurrencyCode } from '@icb/money';

import type { AmlAlertDoc } from './aml-alert.schemas.js';

/**
 * Document to contract. The casts are the boundary between Mongo's schemaless strings and the
 * Zod-validated enums the API promises — values only ever enter the document through this
 * module's services, which write enum members, so the cast cannot lie.
 */

function toMoney(minorUnits: number, currency: string): MoneyDto {
  const code = currency as CurrencyCode;
  return { minorUnits, currency: code, scale: getScale(code) };
}

function aggregateOf(doc: AmlAlertDoc): MoneyDto | null {
  if (doc.aggregateMinorUnits === null || doc.currency === null) {
    return null;
  }
  return toMoney(doc.aggregateMinorUnits, doc.currency);
}

function filedOf(doc: AmlAlertDoc): AmlAlert['filedReport'] {
  if (!doc.filedReport) {
    return null;
  }
  return {
    kind: doc.filedReport.kind as 'sar' | 'ctr',
    reference: doc.filedReport.reference,
    filedAt: doc.filedReport.filedAt.toISOString(),
    asset: null,
  };
}

export function toAmlAlert(doc: AmlAlertDoc): AmlAlert {
  return {
    id: doc._id,
    reference: doc.reference,
    kind: doc.kind as AmlAlertKind,
    customerId: doc.customerId,
    customerName: doc.customerName,
    severity: doc.severity as AlertSeverity,
    status: doc.status as CaseStatus,
    matchDetail: doc.matchDetail,
    matchScore: doc.matchScore ?? null,
    relatedTransactionIds: [...doc.relatedTransactionIds],
    aggregateAmount: aggregateOf(doc),
    narrative: doc.narrative ?? null,
    assignedTo: doc.assignedTo ?? null,
    filedReport: filedOf(doc),
    createdAt: doc.createdAt.toISOString(),
  };
}
