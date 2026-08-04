'use server';

import type {
  Beneficiary,
  BeneficiaryVerification,
  TransferDestination,
} from '@icb/contracts';
import { randomUUID } from 'node:crypto';
import { revalidateTag } from 'next/cache';

import { ApiError, api } from '@/lib/api';

export interface BeneficiaryState {
  status: 'idle' | 'error';
  message: string | null;
  fieldErrors: Record<string, string>;
}

export interface BeneficiaryInput {
  nickname: string;
  name: string;
  favourite: boolean;
  destination: TransferDestination;
}

function messageOf(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.problem.detail : fallback;
}

/**
 * Add a payee. The API applies the cooling-off window on creation — the response carries
 * `coolingOffUntil`, which the UI surfaces rather than discovering at transfer time.
 */
export async function createBeneficiaryAction(
  input: BeneficiaryInput,
): Promise<{ ok: true; beneficiary: Beneficiary } | { ok: false; error: string }> {
  try {
    const beneficiary = await api<Beneficiary>('/beneficiaries', {
      method: 'POST',
      idempotencyKey: randomUUID(),
      body: {
        ...(input.nickname.trim() ? { nickname: input.nickname.trim() } : {}),
        name: input.name.trim(),
        favourite: input.favourite,
        destination: input.destination,
      },
    });
    revalidateTag('beneficiaries', 'max');
    return { ok: true, beneficiary };
  } catch (error) {
    return { ok: false, error: messageOf(error, 'The payee could not be saved.') };
  }
}

export async function updateBeneficiaryAction(input: {
  beneficiaryId: string;
  nickname?: string | null;
  favourite?: boolean;
}): Promise<BeneficiaryState> {
  try {
    await api<Beneficiary>(`/beneficiaries/${input.beneficiaryId}`, {
      method: 'PATCH',
      body: {
        ...(input.nickname !== undefined ? { nickname: input.nickname } : {}),
        ...(input.favourite !== undefined ? { favourite: input.favourite } : {}),
      },
    });
    revalidateTag('beneficiaries', 'max');
    return { status: 'idle', message: null, fieldErrors: {} };
  } catch (error) {
    return {
      status: 'error',
      message: messageOf(error, 'The payee could not be updated.'),
      fieldErrors: {},
    };
  }
}

export async function deleteBeneficiaryAction(
  beneficiaryId: string,
): Promise<BeneficiaryState> {
  try {
    await api(`/beneficiaries/${beneficiaryId}`, { method: 'DELETE' });
    revalidateTag('beneficiaries', 'max');
    return { status: 'idle', message: null, fieldErrors: {} };
  } catch (error) {
    return {
      status: 'error',
      message: messageOf(error, 'The payee could not be removed.'),
      fieldErrors: {},
    };
  }
}

/** Kick off micro-deposit verification: two small credits to the payee's account. */
export async function sendVerificationDepositsAction(
  beneficiaryId: string,
): Promise<{ ok: true; verification: BeneficiaryVerification } | { ok: false; error: string }> {
  try {
    const verification = await api<BeneficiaryVerification>(
      `/beneficiaries/${beneficiaryId}/verify/send`,
      { method: 'POST', idempotencyKey: randomUUID() },
    );
    revalidateTag('beneficiaries', 'max');
    return { ok: true, verification };
  } catch (error) {
    return { ok: false, error: messageOf(error, 'The verification deposits could not be sent.') };
  }
}

/** Confirm the two micro-deposit amounts the payee reports seeing. */
export async function confirmVerificationAction(input: {
  beneficiaryId: string;
  firstAmountMinorUnits: number;
  secondAmountMinorUnits: number;
}): Promise<{ ok: true; verification: BeneficiaryVerification } | { ok: false; error: string }> {
  try {
    const verification = await api<BeneficiaryVerification>(
      `/beneficiaries/${input.beneficiaryId}/verify/confirm`,
      {
        method: 'POST',
        idempotencyKey: randomUUID(),
        body: {
          firstAmountMinorUnits: input.firstAmountMinorUnits,
          secondAmountMinorUnits: input.secondAmountMinorUnits,
        },
      },
    );
    revalidateTag('beneficiaries', 'max');
    return { ok: true, verification };
  } catch (error) {
    return { ok: false, error: messageOf(error, 'Those amounts were not accepted.') };
  }
}
