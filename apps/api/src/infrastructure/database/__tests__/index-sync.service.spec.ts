import type { Connection } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import type { AppConfiguration } from '../../../config/configuration.js';
import { IndexSyncService } from '../index-sync.service.js';

function setup(isProduction: boolean) {
  const models = {
    accounts: { syncIndexes: vi.fn().mockResolvedValue(undefined) },
    ledger: { syncIndexes: vi.fn().mockResolvedValue(undefined) },
  };
  const connection = { models } as unknown as Connection;
  const config = { isProduction } as AppConfiguration;
  const service = new IndexSyncService(connection, config);
  return { models, service };
}

describe('onApplicationBootstrap', () => {
  it('does nothing outside production, where Mongoose autoIndex already applies', async () => {
    const { models, service } = setup(false);

    await service.onApplicationBootstrap();

    expect(models.accounts.syncIndexes).not.toHaveBeenCalled();
    expect(models.ledger.syncIndexes).not.toHaveBeenCalled();
  });

  it('synchronises indexes for every registered model in production', async () => {
    const { models, service } = setup(true);

    await service.onApplicationBootstrap();

    expect(models.accounts.syncIndexes).toHaveBeenCalledTimes(1);
    expect(models.ledger.syncIndexes).toHaveBeenCalledTimes(1);
  });
});
