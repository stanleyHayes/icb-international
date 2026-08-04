'use server';

import type { StandingOrder, TransferDetail } from '@icb/contracts';
import { randomUUID } from 'node:crypto';
import { revalidateTag } from 'next/cache';

import { ApiError, api } from '@/lib/api';

export interface CancelState {
  status: 'idle' | 'done' | 'error';
  message: string | null;
}

function messageOf(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.problem.detail : fallback;
}

/** Cancel a scheduled or still-cancellable transfer. The API decides what is cancellable. */
export async function cancelTransferAction(transferId: string): Promise<CancelState> {
  try {
    await api<TransferDetail>(`/transfers/${transferId}/cancel`, {
      method: 'POST',
      idempotencyKey: randomUUID(),
      body: {},
    });
    revalidateTag('transfers', 'max');
    revalidateTag('accounts', 'max');
    return { status: 'done', message: null };
  } catch (error) {
    return {
      status: 'error',
      message: messageOf(error, 'This transfer could not be cancelled.'),
    };
  }
}

/** Cancel a standing order; future occurrences stop, executed ones are untouched. */
export async function cancelStandingOrderAction(standingOrderId: string): Promise<CancelState> {
  try {
    await api<StandingOrder>(`/standing-orders/${standingOrderId}/cancel`, {
      method: 'POST',
      idempotencyKey: randomUUID(),
      body: {},
    });
    revalidateTag('standing-orders', 'max');
    return { status: 'done', message: null };
  } catch (error) {
    return {
      status: 'error',
      message: messageOf(error, 'This standing order could not be cancelled.'),
    };
  }
}
