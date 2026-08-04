'use server';

import {
  addressSchema,
  individualProfileSchema,
  openAccountRequestSchema,
  uploadSignatureRequestSchema,
  type AccountDetail,
  type KycCase,
  type KycDocumentType,
  type UploadSignature,
} from '@icb/contracts';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { api, ApiError } from '@/lib/api';

import type { AuthFormState } from './password-actions';

const identitySchema = z.object({
  individual: individualProfileSchema.pick({
    firstName: true,
    lastName: true,
    dateOfBirth: true,
    nationality: true,
    occupation: true,
    annualIncomeBand: true,
  }),
  residentialAddress: addressSchema,
});

export type SignatureResult =
  | { ok: true; signature: UploadSignature }
  | { ok: false; error: string };

export type ActionResult = { ok: true } | { ok: false; error: string };

/** FormData values are string | File; a File here means a malformed form, treated as empty. */
function textOf(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value : '';
}

/**
 * Step one: who the customer is, beyond a name and a password.
 *
 * Saved straight onto the customer record; the KYC case reads it from there when an analyst
 * reviews the documents.
 */
export async function saveIdentityAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = identitySchema.safeParse({
    individual: {
      firstName: formData.get('firstName'),
      lastName: formData.get('lastName'),
      dateOfBirth: formData.get('dateOfBirth'),
      nationality: textOf(formData.get('nationality')).toUpperCase(),
      occupation: formData.get('occupation') || undefined,
      annualIncomeBand: formData.get('annualIncomeBand') || undefined,
    },
    residentialAddress: {
      line1: formData.get('line1'),
      city: formData.get('city'),
      region: formData.get('region') || undefined,
      postalCode: formData.get('postalCode') || undefined,
      country: textOf(formData.get('country')).toUpperCase(),
    },
  });

  if (!parsed.success) {
    return {
      error: null,
      done: false,
      fieldErrors: Object.fromEntries(
        parsed.error.issues.map((issue) => [issue.path.map(String).join('.'), issue.message]),
      ),
    };
  }

  try {
    await api('/customers/me', { method: 'PATCH', body: parsed.data });
  } catch (error) {
    if (error instanceof ApiError) {
      return { error: error.problem.detail, done: false, fieldErrors: {} };
    }
    throw error;
  }

  redirect('/onboarding?step=documents');
}

/**
 * Mint a signed upload slot for one document.
 *
 * The document bytes go browser → storage provider directly; this server only vouches for the
 * slot, so identity documents never transit our Next.js process either.
 */
export async function mintUploadSignatureAction(input: {
  documentType: KycDocumentType;
  filename: string;
  contentType: string;
  sizeBytes: number;
}): Promise<SignatureResult> {
  const parsed = uploadSignatureRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'That file cannot be accepted. Use a JPEG, PNG, WebP or PDF under 15 MB.' };
  }

  try {
    const signature = await api<UploadSignature>('/kyc/upload-signature', {
      method: 'POST',
      body: parsed.data,
      idempotencyKey: crypto.randomUUID(),
    });
    return { ok: true, signature };
  } catch (error) {
    if (error instanceof ApiError) {
      return { ok: false, error: error.problem.detail };
    }
    throw error;
  }
}

const attachSchema = z.object({
  type: uploadSignatureRequestSchema.shape.documentType,
  publicId: z.string().min(1).max(255),
  resourceType: z.enum(['image', 'raw', 'video']),
  format: z.string().max(10).optional(),
  bytes: z.int().nonnegative().optional(),
  originalFilename: z.string().max(255).optional(),
  uploadedAt: z.iso.datetime({ offset: true }),
});

/** Attach an already-uploaded asset to the customer's KYC case. */
export async function attachDocumentAction(input: z.input<typeof attachSchema>): Promise<ActionResult> {
  const parsed = attachSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'The upload did not complete. Please try again.' };
  }

  const { type, ...asset } = parsed.data;
  try {
    await api<KycCase>('/kyc/documents', {
      method: 'POST',
      body: { type, asset: { provider: 'cloudinary', ...asset } },
      idempotencyKey: crypto.randomUUID(),
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return { ok: false, error: error.problem.detail };
    }
    throw error;
  }

  revalidatePath('/onboarding');
  return { ok: true };
}

/**
 * Submit the case for review.
 *
 * Tier 2 is the standard full account: higher limits than the entry tier, without the
 * enhanced-due-diligence questions tier 3 would add.
 */
export async function submitKycAction(): Promise<ActionResult> {
  try {
    await api<KycCase>('/kyc/submit', {
      method: 'POST',
      body: { requestedLevel: 'tier_2', declarationAccepted: true },
      idempotencyKey: crypto.randomUUID(),
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return { ok: false, error: error.problem.detail };
    }
    throw error;
  }

  revalidatePath('/onboarding');
  return { ok: true };
}

/** Final step: open the first account. Idempotent, so a double-submit opens exactly one. */
export async function openAccountAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = openAccountRequestSchema.safeParse({
    productCode: formData.get('productCode'),
    currency: formData.get('currency'),
    nickname: formData.get('nickname') || undefined,
  });

  if (!parsed.success) {
    return {
      error: null,
      done: false,
      fieldErrors: Object.fromEntries(
        parsed.error.issues.map((issue) => [issue.path.map(String).join('.'), issue.message]),
      ),
    };
  }

  try {
    await api<AccountDetail>('/accounts', {
      method: 'POST',
      body: parsed.data,
      idempotencyKey: crypto.randomUUID(),
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return { error: error.problem.detail, done: false, fieldErrors: {} };
    }
    throw error;
  }

  redirect('/onboarding?step=done');
}
