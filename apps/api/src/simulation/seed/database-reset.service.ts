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
  // Both trails reference customers, accounts and postings by id. A reset that destroys those
  // and leaves the trails behind produces an audit history pointing at records that no longer
  // exist — and, because the governance trail is hashed head-to-tail, a chain whose surviving
  // links can never verify against the bank they now sit beside.
  'audit_events',
  'security_events',
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
