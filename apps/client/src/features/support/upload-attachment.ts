import 'server-only';

import type { AssetRef, UploadSignature } from '@icb/contracts';

import { api } from '@/lib/api';

/**
 * Uploads one attachment via the API's signed-grant flow: the API mints a short-lived
 * signature, and the bytes are posted straight to the storage provider from this server —
 * never through the browser, and never through the API itself.
 *
 * Returns the asset reference the ticket message then points at. Throws on any failure; the
 * caller turns that into a form error, because a message that silently drops its attachments
 * is worse than one that refuses to send.
 */
export async function uploadAttachment(file: File): Promise<AssetRef> {
  const grant = await api<UploadSignature>('/support/attachments/upload-signature', {
    method: 'POST',
    body: { filename: file.name, contentType: file.type, sizeBytes: file.size },
  });

  const payload = new FormData();
  payload.set('file', file);
  payload.set('api_key', grant.apiKey);
  payload.set('timestamp', String(grant.timestamp));
  payload.set('signature', grant.signature);
  payload.set('public_id', grant.publicId);
  payload.set('folder', grant.folder);

  const response = await fetch(grant.uploadUrl, { method: 'POST', body: payload });
  if (!response.ok) {
    throw new AttachmentUploadError(file.name);
  }

  return {
    provider: 'cloudinary',
    publicId: grant.publicId,
    resourceType: file.type.startsWith('image/') ? 'image' : 'raw',
    format: file.name.split('.').pop() ?? '',
    bytes: file.size,
    originalFilename: file.name,
    uploadedAt: new Date().toISOString(),
  };
}

export class AttachmentUploadError extends Error {
  constructor(filename: string) {
    super(`"${filename}" could not be uploaded.`);
    this.name = 'AttachmentUploadError';
  }
}
