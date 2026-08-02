import { beforeEach, describe, expect, it, vi } from 'vitest';

const configMock = vi.fn();
const signMock = vi.fn<(params: Record<string, unknown>, secret: string) => string>();
const urlMock = vi.fn<(publicId: string, options: Record<string, unknown>) => string>();
const privateDownloadMock =
  vi.fn<(publicId: string, format: string, options: Record<string, unknown>) => string>();
const uploadMock =
  vi.fn<(file: string, options: Record<string, unknown>) => Promise<Record<string, unknown>>>();
const destroyMock =
  vi.fn<(publicId: string, options: Record<string, unknown>) => Promise<Record<string, unknown>>>();

vi.mock('cloudinary', () => ({
  v2: {
    config: configMock,
    utils: { api_sign_request: signMock, private_download_url: privateDownloadMock },
    uploader: { upload: uploadMock, destroy: destroyMock },
    url: urlMock,
  },
}));

const { createCloudinaryAssetStore, createCloudinaryPorts } = await import(
  '../cloudinary-adapter.js'
);

const CREDENTIALS = { cloudName: 'icb-cloud', apiKey: 'key-1', apiSecret: 'secret-1' };
const AVATAR_TRANSFORMATION = {
  width: 256,
  height: 256,
  crop: 'fill',
  gravity: 'face',
  quality: 'auto:good',
  fetchFormat: 'auto',
} as const;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createCloudinaryPorts', () => {
  it('configures the client with the account credentials', () => {
    createCloudinaryPorts(CREDENTIALS);
    expect(configMock).toHaveBeenCalledWith({
      cloud_name: 'icb-cloud',
      api_key: 'key-1',
      api_secret: 'secret-1',
      secure: true,
    });
  });

  it('delegates upload signing to the client with the API secret', () => {
    signMock.mockReturnValue('signed-value');
    const ports = createCloudinaryPorts(CREDENTIALS);

    const signature = ports.uploads.signParams({ folder: 'f', timestamp: 1 });

    expect(signature).toBe('signed-value');
    expect(signMock).toHaveBeenCalledWith({ folder: 'f', timestamp: 1 }, 'secret-1');
  });

  it('builds a signed authenticated render URL with the mapped transformation', () => {
    urlMock.mockReturnValue('https://res.cloudinary.com/icb-cloud/image/authenticated/s--x--/p');
    const ports = createCloudinaryPorts(CREDENTIALS);

    const url = ports.delivery.signedUrl({
      publicId: 'p',
      resourceType: 'image',
      transformation: AVATAR_TRANSFORMATION,
      expiresAtEpochSeconds: 1_700_000_300,
      attachment: false,
    });

    expect(url).toContain('s--x--');
    expect(urlMock).toHaveBeenCalledWith('p', {
      resource_type: 'image',
      type: 'authenticated',
      secure: true,
      sign_url: true,
      expires_at: 1_700_000_300,
      transformation: {
        width: 256,
        height: 256,
        crop: 'fill',
        gravity: 'face',
        quality: 'auto:good',
        fetch_format: 'auto',
      },
    });
  });

  it('routes downloads through the endpoint that enforces expiry', () => {
    privateDownloadMock.mockReturnValue('https://api.cloudinary.com/v1_1/icb-cloud/raw/download?x');
    const ports = createCloudinaryPorts(CREDENTIALS);

    const url = ports.delivery.signedUrl({
      publicId: 'icb/statements/a/june',
      resourceType: 'raw',
      format: 'pdf',
      expiresAtEpochSeconds: 1_700_000_300,
      attachment: true,
    });

    expect(url).toContain('/download');
    expect(privateDownloadMock).toHaveBeenCalledWith('icb/statements/a/june', 'pdf', {
      resource_type: 'raw',
      type: 'authenticated',
      expires_at: 1_700_000_300,
      attachment: true,
    });
    expect(urlMock).not.toHaveBeenCalled();
  });

  it('uploads bytes as a data URI under the authenticated delivery type', async () => {
    uploadMock.mockResolvedValue({
      public_id: 'icb/statements/a/june-1',
      resource_type: 'raw',
      format: 'pdf',
      bytes: 4,
    });
    const ports = createCloudinaryPorts(CREDENTIALS);

    const result = await ports.uploads.upload({
      folder: 'icb/statements/a',
      publicId: 'june-1',
      resourceType: 'raw',
      contentType: 'application/pdf',
      bytes: new Uint8Array([37, 80, 68, 70]),
    });

    expect(result).toEqual({
      publicId: 'icb/statements/a/june-1',
      resourceType: 'raw',
      format: 'pdf',
      bytes: 4,
    });
    const [file, options] = uploadMock.mock.calls[0] ?? [];
    expect(file).toBe('data:application/pdf;base64,JVBERg==');
    expect(options).toMatchObject({ type: 'authenticated', overwrite: false });
  });

  it('deletes an asset and invalidates the CDN copy', async () => {
    destroyMock.mockResolvedValue({ result: 'ok' });
    const ports = createCloudinaryPorts(CREDENTIALS);

    await ports.uploads.destroy({ publicId: 'icb/kyc/c/passport-1', resourceType: 'image' });

    expect(destroyMock).toHaveBeenCalledWith('icb/kyc/c/passport-1', {
      resource_type: 'image',
      type: 'authenticated',
      invalidate: true,
    });
  });
});

describe('createCloudinaryAssetStore', () => {
  it('returns a working store wired to the client ports', () => {
    signMock.mockReturnValue('client-signature');
    const store = createCloudinaryAssetStore(
      { ...CREDENTIALS, rootFolder: 'icb' },
      { now: () => 1_700_000_000_000, generateId: () => 'uid-1' },
    );

    const grant = store.mintUploadSignature({
      kind: 'kyc',
      ownerId: 'cus_1',
      contentType: 'image/jpeg',
      sizeBytes: 10,
    });

    expect(grant.signature).toBe('client-signature');
    expect(grant.uploadUrl).toContain('icb-cloud');
    expect(grant.type).toBe('authenticated');
  });
});
