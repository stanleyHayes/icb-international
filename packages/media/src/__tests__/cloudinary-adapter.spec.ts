import { beforeEach, describe, expect, it, vi } from 'vitest';

const configMock = vi.fn();
const signMock = vi.fn<(params: Record<string, unknown>, secret: string) => string>();
const urlMock = vi.fn<(publicId: string, options: Record<string, unknown>) => string>();

vi.mock('cloudinary', () => ({
  v2: {
    config: configMock,
    utils: { api_sign_request: signMock },
    url: urlMock,
  },
}));

const { createCloudinaryAssetStore, createCloudinaryPorts } = await import(
  '../cloudinary-adapter.js'
);

const CREDENTIALS = { cloudName: 'icb-cloud', apiKey: 'key-1', apiSecret: 'secret-1' };

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

  it('builds signed delivery URLs with the mapped transformation', () => {
    urlMock.mockReturnValue('https://res.cloudinary.com/icb-cloud/image/upload/s--x--/p');
    const ports = createCloudinaryPorts(CREDENTIALS);

    const url = ports.delivery.signedUrl({
      publicId: 'p',
      resourceType: 'image',
      transformation: {
        width: 256,
        height: 256,
        crop: 'fill',
        gravity: 'face',
        quality: 'auto:good',
        fetchFormat: 'auto',
      },
    });

    expect(url).toContain('s--x--');
    expect(urlMock).toHaveBeenCalledWith('p', {
      resource_type: 'image',
      type: 'upload',
      secure: true,
      sign_url: true,
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

  it('passes the format through for raw assets and omits absent options', () => {
    const ports = createCloudinaryPorts(CREDENTIALS);
    ports.delivery.signedUrl({ publicId: 'doc', resourceType: 'raw', format: 'pdf' });

    expect(urlMock).toHaveBeenCalledWith('doc', {
      resource_type: 'raw',
      type: 'upload',
      secure: true,
      sign_url: true,
      format: 'pdf',
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
  });
});
