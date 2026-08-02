import { describe, expect, it } from 'vitest';

import { buildAssetRef } from '../asset-ref.js';
import { CloudinaryAssetStore, type CloudinaryStoreConfig } from '../cloudinary-store.js';
import { UnsupportedMediaTypeError, TransformationNotSupportedError } from '../errors.js';
import type { CloudinaryDeliveryRequest, CloudinaryPorts } from '../ports.js';

const NOW = 1_700_000_000_000;
const CONFIG: CloudinaryStoreConfig = {
  cloudName: 'icb-cloud',
  apiKey: 'key-123',
  rootFolder: 'icb',
};

function fakePorts(): CloudinaryPorts & {
  signedParams: Readonly<Record<string, string | number>>[];
  signed: CloudinaryDeliveryRequest[];
} {
  const signedParams: Readonly<Record<string, string | number>>[] = [];
  const signed: CloudinaryDeliveryRequest[] = [];
  return {
    signedParams,
    signed,
    uploads: {
      signParams: (params) => {
        signedParams.push(params);
        return 'deadbeefsignature';
      },
    },
    delivery: {
      signedUrl: (request: CloudinaryDeliveryRequest) => {
        signed.push(request);
        return `https://res.cloudinary.com/icb-cloud/${request.resourceType}/upload/s--sig--/${request.publicId}`;
      },
    },
  };
}

function makeStore(ports = fakePorts(), config = CONFIG): CloudinaryAssetStore {
  return new CloudinaryAssetStore(config, ports, { now: () => NOW, generateId: () => 'uid-1' });
}

const IMAGE_REF = buildAssetRef({
  publicId: 'icb/kyc/cus_1/passport-uid-1',
  resourceType: 'image',
  uploadedAt: '2026-01-15T10:30:00.000Z',
});

const PDF_REF = buildAssetRef({
  publicId: 'icb/statements/acc_1/statement-uid-1',
  resourceType: 'raw',
  format: 'pdf',
  uploadedAt: '2026-01-15T10:30:00.000Z',
});

describe('mintUploadSignature', () => {
  it('mints a cloudinary-shaped grant following the folder/public-id conventions', () => {
    const ports = fakePorts();
    const grant = makeStore(ports).mintUploadSignature({
      kind: 'kyc',
      ownerId: 'cus_1',
      contentType: 'image/jpeg',
      sizeBytes: 500_000,
      label: 'Passport',
    });

    expect(grant).toEqual({
      uploadUrl: 'https://api.cloudinary.com/v1_1/icb-cloud/image/upload',
      publicId: 'passport-uid-1',
      folder: 'icb/kyc/cus_1',
      timestamp: 1_700_000_000,
      signature: 'deadbeefsignature',
      apiKey: 'key-123',
      expiresAt: '2023-11-14T22:18:20.000Z',
    });
    expect(ports.signedParams[0]).toEqual({
      folder: 'icb/kyc/cus_1',
      public_id: 'passport-uid-1',
      timestamp: 1_700_000_000,
    });
  });

  it('targets the raw endpoint for PDFs and defaults the label to the kind', () => {
    const grant = makeStore().mintUploadSignature({
      kind: 'dispute-evidence',
      ownerId: 'disp_1',
      contentType: 'application/pdf',
      sizeBytes: 100,
    });
    expect(grant.uploadUrl).toContain('/raw/upload');
    expect(grant.publicId).toBe('dispute-evidence-uid-1');
  });

  it('honours a configured signature TTL', () => {
    const store = makeStore(fakePorts(), { ...CONFIG, uploadSignatureTtlSeconds: 60 });
    const grant = store.mintUploadSignature({
      kind: 'avatars',
      ownerId: 'cus_1',
      contentType: 'image/png',
      sizeBytes: 100,
    });
    expect(grant.expiresAt).toBe('2023-11-14T22:14:20.000Z');
  });

  it('refuses to sign an upload outside the allow-list', () => {
    expect(() =>
      makeStore().mintUploadSignature({
        kind: 'avatars',
        ownerId: 'cus_1',
        contentType: 'image/gif',
        sizeBytes: 100,
      }),
    ).toThrow(UnsupportedMediaTypeError);
  });
});

describe('signedDeliveryUrl', () => {
  it('passes the preset transformation through to the delivery port', () => {
    const ports = fakePorts();
    const link = makeStore(ports).signedDeliveryUrl(IMAGE_REF, { preset: 'document-thumbnail' });

    expect(link.url).toContain('s--sig--');
    expect(ports.signed[0]?.transformation).toMatchObject({ width: 300, height: 300 });
    expect(link.expiresAt).toBe('2023-11-14T22:18:20.000Z');
  });

  it('omits the transformation when no preset is requested', () => {
    const ports = fakePorts();
    makeStore(ports).signedDeliveryUrl(IMAGE_REF);
    expect(ports.signed[0]).not.toHaveProperty('transformation');
  });

  it('carries the format so raw assets are served with their extension', () => {
    const ports = fakePorts();
    makeStore(ports).signedDeliveryUrl(PDF_REF);
    expect(ports.signed[0]?.format).toBe('pdf');
  });

  it('rejects a transformation preset for a raw asset', () => {
    expect(() => makeStore().signedDeliveryUrl(PDF_REF, { preset: 'document-thumbnail' })).toThrow(
      TransformationNotSupportedError,
    );
  });

  it('honours a per-call TTL override', () => {
    const link = makeStore().signedDeliveryUrl(IMAGE_REF, { expiresInSeconds: 30 });
    expect(link.expiresAt).toBe('2023-11-14T22:13:50.000Z');
  });
});
