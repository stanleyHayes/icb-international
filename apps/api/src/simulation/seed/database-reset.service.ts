import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';

/**
 * Collections the seed owns and may therefore clear.
 *
 * Listed explicitly rather than dropping the database: an operator running `db:reset` must not
 * lose anything the seed did not create.
 */
const SEEDED_COLLECTIONS = [
  'customers',
  'user_credentials',
  'sessions',
  'accounts',
  'account_balances',
  'ledger_transactions',
  'ledger_entries',
  'holds',
  'transfers',
] as const;

@Injectable()
export class DatabaseResetService {
  private readonly logger = new Logger(DatabaseResetService.name);

  constructor(@InjectConnection() private readonly connection: Connection) {}

  async clearSeededCollections(): Promise<void> {
    for (const name of SEEDED_COLLECTIONS) {
      await this.connection.collection(name).deleteMany({});
    }
    this.logger.log({ collections: SEEDED_COLLECTIONS.length }, 'Database reset');
  }
}
