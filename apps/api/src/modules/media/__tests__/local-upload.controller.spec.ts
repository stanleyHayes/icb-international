import type { FastifyRequest } from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ValidationError } from '../../../common/errors/index.js';
import type {
  LocalUploadResponse,
  LocalUploadService,
} from '../application/local-upload.service.js';
import { LocalUploadController } from '../local-upload.controller.js';

const RESPONSE: LocalUploadResponse = {
  public_id: 'icb/kyc/cust-1/passport-01',
  resource_type: 'image',
};

const GRANT_FIELDS: Record<string, string> = {
  api_key: 'local',
  timestamp: '1700000000',
  signature: 'abc123',
  folder: 'icb/kyc/cust-1',
  public_id: 'passport-01',
};

interface FakePart {
  type: string;
  fieldname: string;
  value?: unknown;
  filename?: string;
  mimetype?: string;
  toBuffer?: () => Promise<Buffer>;
}

function fieldPart(fieldname: string, value: unknown): FakePart {
  return { type: 'field', fieldname, value };
}

function filePart(overrides: Partial<FakePart> = {}): FakePart {
  return {
    type: 'file',
    fieldname: 'file',
    filename: 'passport.png',
    mimetype: 'image/png',
    toBuffer: () => Promise.resolve(Buffer.from([1, 2, 3])),
    ...overrides,
  };
}

function grantParts(fields: Record<string, unknown> = GRANT_FIELDS): FakePart[] {
  return Object.entries(fields).map(([name, value]) => fieldPart(name, value));
}

function multipartRequest(parts: FakePart[]): FastifyRequest {
  return {
    parts: function* () {
      for (const part of parts) yield part;
    },
  } as unknown as FastifyRequest;
}

describe('LocalUploadController', () => {
  let accept: ReturnType<typeof vi.fn>;
  let controller: LocalUploadController;

  beforeEach(() => {
    accept = vi.fn().mockResolvedValue(RESPONSE);
    controller = new LocalUploadController({ accept } as unknown as LocalUploadService);
  });

  it('shapes the multipart body into a grant and returns the service response', async () => {
    const result = await controller.upload(multipartRequest([...grantParts(), filePart()]));

    expect(accept).toHaveBeenCalledWith(
      {
        apiKey: 'local',
        timestamp: 1_700_000_000,
        signature: 'abc123',
        folder: 'icb/kyc/cust-1',
        publicId: 'passport-01',
      },
      {
        contentType: 'image/png',
        originalFilename: 'passport.png',
        bytes: Buffer.from([1, 2, 3]),
      },
    );
    expect(result).toBe(RESPONSE);
  });

  it('rejects the request when no file part arrives', async () => {
    await expect(controller.upload(multipartRequest(grantParts()))).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(accept).not.toHaveBeenCalled();
  });

  it('rejects a second file part — exactly one is expected', async () => {
    const parts = [...grantParts(), filePart(), filePart({ filename: 'extra.png' })];

    await expect(controller.upload(multipartRequest(parts))).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      fieldErrors: [{ path: 'file', message: 'Expected exactly one file part' }],
    });
    expect(accept).not.toHaveBeenCalled();
  });

  it('rejects an incomplete grant and names every missing field', async () => {
    const partial = Object.fromEntries(
      Object.entries(GRANT_FIELDS).filter(([name]) => name !== 'folder' && name !== 'public_id'),
    );

    await expect(
      controller.upload(multipartRequest([...grantParts(partial), filePart()])),
    ).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      fieldErrors: [
        { path: 'folder', message: 'Required for a signed upload' },
        { path: 'public_id', message: 'Required for a signed upload' },
      ],
    });
    expect(accept).not.toHaveBeenCalled();
  });

  it('rejects a non-numeric timestamp even when every field is present', async () => {
    const parts = [...grantParts({ ...GRANT_FIELDS, timestamp: 'not-a-number' }), filePart()];

    await expect(controller.upload(multipartRequest(parts))).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(accept).not.toHaveBeenCalled();
  });

  it('coerces a non-string scalar field before parsing the grant', async () => {
    const parts = [...grantParts({ ...GRANT_FIELDS, timestamp: 1_700_000_000 }), filePart()];

    await controller.upload(multipartRequest(parts));

    expect(accept).toHaveBeenCalledWith(
      expect.objectContaining({ timestamp: 1_700_000_000 }),
      expect.anything(),
    );
  });
});
