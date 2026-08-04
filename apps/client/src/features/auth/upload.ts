'use client';

import type { KycDocumentType } from '@icb/contracts';

import { attachDocumentAction, mintUploadSignatureAction, type ActionResult } from './onboarding-actions';

/** What the storage provider answers a successful direct upload with (Cloudinary's shape). */
interface UploadResponse {
  public_id?: string;
  resource_type?: string;
  format?: string;
  bytes?: number;
  original_filename?: string;
}

/**
 * One document, end to end: mint a signed slot on our server, push the bytes straight to the
 * storage provider from the browser, then tell the API what landed.
 *
 * The bytes never transit either our API or this Next.js server — the signed-url pattern keeps
 * identity documents out of every log and crash dump on our side (N2 permits this one egress).
 */
export async function uploadKycDocument(
  file: File,
  documentType: KycDocumentType,
): Promise<ActionResult> {
  const minted = await mintUploadSignatureAction({
    documentType,
    filename: file.name,
    contentType: file.type,
    sizeBytes: file.size,
  });
  if (!minted.ok) {
    return minted;
  }

  const { signature } = minted;
  const body = new FormData();
  body.append('file', file);
  body.append('api_key', signature.apiKey);
  body.append('timestamp', String(signature.timestamp));
  body.append('signature', signature.signature);
  body.append('folder', signature.folder);
  body.append('public_id', signature.publicId);

  let uploaded: UploadResponse;
  try {
    const response = await fetch(signature.uploadUrl, { method: 'POST', body });
    if (!response.ok) {
      return { ok: false, error: 'The upload failed. Please try again.' };
    }
    uploaded = (await response.json()) as UploadResponse;
  } catch {
    return { ok: false, error: 'The upload could not reach storage. Check your connection and retry.' };
  }

  return attachDocumentAction({
    type: documentType,
    publicId: uploaded.public_id ?? signature.publicId,
    resourceType: uploaded.resource_type === 'raw' ? 'raw' : 'image',
    ...(uploaded.format !== undefined ? { format: uploaded.format } : {}),
    ...(uploaded.bytes !== undefined ? { bytes: uploaded.bytes } : {}),
    originalFilename: uploaded.original_filename ?? file.name,
    uploadedAt: new Date().toISOString(),
  });
}
