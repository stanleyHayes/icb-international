import type { TransferTemplate } from '@icb/contracts';

import { rruleFor } from '../transfer.constants';
import { initialDraft, type ScheduleDraft, type TransferDraft } from './draft-types';

/** Turn the schedule draft into the contract's schedule object; `undefined` means "now". */
export function schedulePayload(
  schedule: ScheduleDraft,
): { startsOn: string; rrule?: string; endsOn?: string } | undefined {
  if (schedule.mode === 'now') {
    return undefined;
  }
  if (schedule.mode === 'later') {
    return { startsOn: schedule.startsOn };
  }
  return {
    startsOn: schedule.startsOn,
    rrule: rruleFor(schedule.frequency),
    ...(schedule.endsOn ? { endsOn: schedule.endsOn } : {}),
  };
}

/** Prefill a draft from a saved template: the rail follows the destination kind. */
export function draftFromTemplate(template: TransferTemplate): Partial<TransferDraft> {
  const destination = template.destination;
  const base = {
    amountMinorUnits: template.amount?.minorUnits ?? null,
    reference: template.reference ?? '',
    fromAccountId: template.fromAccountId,
  };
  switch (destination.kind) {
    case 'own_account':
      return {
        ...base,
        rail: 'internal',
        destination: { ...initialDraft('internal', '').destination, accountId: destination.accountId },
      };
    case 'icb_customer':
      return {
        ...base,
        rail: 'on_us',
        destination: { ...initialDraft('on_us', '').destination, accountNumber: destination.accountNumber },
      };
    case 'domestic_bank':
      return {
        ...base,
        rail: 'ach',
        destination: {
          ...initialDraft('ach', '').destination,
          holderName: destination.accountHolderName,
          sortCode: destination.sortCode,
          accountNumber: destination.accountNumber,
        },
      };
    case 'international':
      return {
        ...base,
        rail: 'swift',
        destination: {
          ...initialDraft('swift', '').destination,
          holderName: destination.accountHolderName,
          iban: destination.iban,
          bic: destination.bic,
          country: destination.country,
          bankName: destination.bankName ?? '',
        },
      };
    case 'beneficiary':
      return base;
  }
}
