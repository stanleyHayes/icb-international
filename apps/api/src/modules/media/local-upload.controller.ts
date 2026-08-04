import { Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { Public } from '../../common/decorators/public.decorator.js';
import { ValidationError } from '../../common/errors/index.js';
import {
  LocalUploadService,
  type LocalUploadFile,
  type LocalUploadGrant,
  type LocalUploadResponse,
} from './application/local-upload.service.js';

const REQUIRED_GRANT_FIELDS = ['api_key', 'timestamp', 'signature', 'folder', 'public_id'] as const;

interface MultipartBody {
  fields: Record<string, string>;
  file: LocalUploadFile | null;
}

/**
 * The offline stand-in for the storage provider's upload endpoint.
 *
 * The browser posts here — not through the app's own server — with the multipart shape a
 * direct-to-provider upload uses, so the route is public: the signed grant in the body is the
 * credential, exactly as it is with the real provider.
 */
@Controller('media')
export class LocalUploadController {
  constructor(private readonly uploads: LocalUploadService) {}

  @Public()
  @Post('local-upload')
  @HttpCode(HttpStatus.OK)
  async upload(@Req() request: FastifyRequest): Promise<LocalUploadResponse> {
    const { fields, file } = await readMultipart(request);
    if (file === null) {
      throw new ValidationError('The request failed validation', [
        { path: 'file', message: 'Expected exactly one file part' },
      ]);
    }
    return this.uploads.accept(toGrant(fields), file);
  }
}

/** Drains the multipart stream: scalar fields collected, the single file buffered. */
async function readMultipart(request: FastifyRequest): Promise<MultipartBody> {
  const fields: Record<string, string> = {};
  let file: LocalUploadFile | null = null;
  for await (const part of request.parts()) {
    if (part.type !== 'file') {
      fields[part.fieldname] = typeof part.value === 'string' ? part.value : String(part.value);
      continue;
    }
    if (file !== null) {
      throw new ValidationError('The request failed validation', [
        { path: 'file', message: 'Expected exactly one file part' },
      ]);
    }
    file = {
      contentType: part.mimetype,
      originalFilename: part.filename,
      bytes: await part.toBuffer(),
    };
  }
  return { fields, file };
}

/** Shapes the raw fields into a grant, refusing anything incomplete before it reaches the service. */
function toGrant(fields: Record<string, string>): LocalUploadGrant {
  const missing = REQUIRED_GRANT_FIELDS.filter((name) => !fields[name]);
  const timestamp = Number(fields['timestamp']);
  if (missing.length > 0 || !Number.isFinite(timestamp)) {
    throw new ValidationError(
      'The request failed validation',
      missing.map((path) => ({ path, message: 'Required for a signed upload' })),
    );
  }
  return {
    apiKey: fields['api_key'] ?? '',
    timestamp,
    signature: fields['signature'] ?? '',
    folder: fields['folder'] ?? '',
    publicId: fields['public_id'] ?? '',
  };
}
