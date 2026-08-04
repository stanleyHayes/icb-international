'use server';

import {
  createTransferTemplateRequestSchema,
  type TransferDestination,
} from '@icb/contracts';
import { revalidateTag } from 'next/cache';

import { ApiError, api } from '@/lib/api';

import { toWireMoney } from './destination';
import type { ActionResult } from './wizard/action-types';

export interface TemplateInput {
  name: string;
  fromAccountId: string;
  destination: TransferDestination;
  amountMinorUnits: number | null;
  currency: string;
  reference?: string;
}

export async function saveTemplateAction(
  input: TemplateInput,
): Promise<ActionResult<{ saved: true }>> {
  const body = {
    name: input.name,
    fromAccountId: input.fromAccountId,
    destination: input.destination,
    ...(input.amountMinorUnits !== null
      ? { amount: toWireMoney(input.amountMinorUnits, input.currency) }
      : {}),
    ...(input.reference ? { reference: input.reference } : {}),
  };

  const parsed = createTransferTemplateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, error: 'Check the template details and try again.' };
  }

  try {
    await api('/transfer-templates', { method: 'POST', body: parsed.data });
    revalidateTag('transfer-templates', 'max');
    return { ok: true, data: { saved: true } };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof ApiError ? error.problem.detail : 'The template could not be saved.',
    };
  }
}

export async function deleteTemplateAction(
  templateId: string,
): Promise<ActionResult<{ deleted: true }>> {
  try {
    await api(`/transfer-templates/${templateId}`, { method: 'DELETE' });
    revalidateTag('transfer-templates', 'max');
    return { ok: true, data: { deleted: true } };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof ApiError ? error.problem.detail : 'The template could not be deleted.',
    };
  }
}
