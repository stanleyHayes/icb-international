import type { AssetStore } from '@icb/media';
import { describe, expect, it, vi } from 'vitest';

import type { AppConfiguration } from '../../../config/configuration.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { CustomerExportService } from '../customer-export.service.js';
import type { FootprintInput } from '../infrastructure/export-footprint.js';
import type { ExportSourceReader } from '../infrastructure/export-source.reader.js';
import { customerDoc, NOW } from './fixtures.js';

const ASSET = { provider: 'local', publicId: 'icb/statements/01J8ZCQ0R0K3M4N5P6Q7R8S9T0/export-1', format: 'pdf' };

function footprintInput(): FootprintInput {
  return {
    customer: customerDoc(),
    credential: { emailVerified: true, lastLoginAt: NOW },
    sessions: [],
    accounts: [],
    generatedAt: NOW,
    reference: 'EXP-TEST',
  };
}

function setup() {
  const sources = { gather: vi.fn().mockResolvedValue(footprintInput()) };
  const assets = {
    upload: vi.fn().mockResolvedValue(ASSET),
    buildSignedUrl: vi
      .fn()
      .mockReturnValue({ url: 'http://localhost/media/x?sig=1', expiresAt: NOW.toISOString() }),
  };
  const config = { bank: { name: 'ICB' } } as unknown as AppConfiguration;
  const clock = new ClockService();
  clock.freeze(NOW);

  const service = new CustomerExportService(
    sources as unknown as ExportSourceReader,
    assets as unknown as AssetStore,
    config,
    clock,
  );
  return { sources, assets, service };
}

describe('exportData', () => {
  it('stores a rendered PDF in the customer folder and answers with a signed link', async () => {
    const { sources, assets, service } = setup();

    const link = await service.exportData('01J8ZCQ0R0K3M4N5P6Q7R8S9T0');

    expect(sources.gather).toHaveBeenCalledWith('01J8ZCQ0R0K3M4N5P6Q7R8S9T0', NOW, expect.any(String));

    const [upload] = assets.upload.mock.calls[0] as [
      { kind: string; ownerId: string; contentType: string; bytes: Buffer },
    ];
    expect(upload.kind).toBe('statements');
    expect(upload.ownerId).toBe('01J8ZCQ0R0K3M4N5P6Q7R8S9T0');
    expect(upload.contentType).toBe('application/pdf');
    expect(upload.bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');

    expect(assets.buildSignedUrl).toHaveBeenCalledWith(ASSET, undefined, { download: true });
    expect(link).toEqual({
      url: 'http://localhost/media/x?sig=1',
      expiresAt: NOW.toISOString(),
      filename: 'personal-data-export.pdf',
    });
  });
});
