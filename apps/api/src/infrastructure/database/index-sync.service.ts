import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';

import { CONFIG, type AppConfiguration } from '../../config/configuration.js';

/**
 * Reconciles Mongo indexes with the declared schemas at boot.
 *
 * Development relies on Mongoose `autoIndex`, which builds indexes as models register but never
 * removes one that was dropped from a schema. In production `autoIndex` is off (see
 * DatabaseModule), so this service runs `syncIndexes` instead: it creates what is declared and
 * drops what no longer is, which is the only way an index removal actually reaches the
 * database. Gated on the same configuration flag that turns `autoIndex` off, so exactly one of
 * the two mechanisms is ever active.
 */
@Injectable()
export class IndexSyncService implements OnApplicationBootstrap {
  private readonly logger = new Logger(IndexSyncService.name);
  private readonly enabled: boolean;

  constructor(
    @InjectConnection() private readonly connection: Connection,
    @Inject(CONFIG) config: AppConfiguration,
  ) {
    this.enabled = config.isProduction;
  }

  async onApplicationBootstrap(): Promise<void> {
    if (!this.enabled) {
      return;
    }
    const models = Object.values(this.connection.models);
    for (const model of models) {
      await model.syncIndexes();
    }
    this.logger.log({ collections: models.length }, 'Mongo indexes synchronised');
  }
}
