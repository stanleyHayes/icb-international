'use server';

import { bulkTransferRequestSchema, type BulkTransferResult } from '@icb/contracts';
import { randomUUID } from 'node:crypto';
import { revalidateTag } from 'next/cache';

import { ApiError, api } from '@/lib/api';

import { toWireMoney } from './destination';
import type { ActionResult } from './wizard/action-types';

export interface BulkRowInput {
  rowNumber: number;
  accountHolderName: string;
  sortCode: string;
  accountNumber: string;
  amountMinorUnits: number;
  reference?: string;
}

/**
 * Submit a validated CSV batch. Rows were checked in the browser first; the contract schema
 * checks them again here because the browser is not a trust boundary.
 */
export async function submitBulkTransferAction(input: {
  fromAccountId: string;
  currency: string;
  rows: BulkRowInput[];
}): Promise<ActionResult<BulkTransferResult>> {
  const body = {
    fromAccountId: input.fromAccountId,
    rows: input.rows.map((row) => ({
      rowNumber: row.rowNumber,
      destination: {
        kind: 'domestic_bank',
        accountHolderName: row.accountHolderName,
        sortCode: row.sortCode,
        accountNumber: row.accountNumber,
      },
      amount: toWireMoney(row.amountMinorUnits, input.currency),
      ...(row.reference ? { reference: row.reference } : {}),
    })),
  };

  const parsed = bulkTransferRequestSchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, error: 'Some rows are invalid. Fix the highlighted rows and resubmit.' };
  }

  try {
    const result = await api<BulkTransferResult>('/transfers/bulk', {
      method: 'POST',
      idempotencyKey: randomUUID(),
      body: parsed.data,
    });
    revalidateTag('accounts', 'max');
    revalidateTag('transfers', 'max');
    return { ok: true, data: result };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof ApiError ? error.problem.detail : 'The batch could not be submitted.',
    };
  }
}
