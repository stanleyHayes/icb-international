import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { CONFIG, type AppConfiguration } from '../../config/configuration.js';
import { TransactionManager } from './transaction.manager.js';

/**
 * Mongoose connection.
 *
 * `retryWrites` is off: the ledger drives its own retries through TransactionManager, and having
 * two layers retry the same write independently makes failure behaviour impossible to reason
 * about. Write concern is `majority` so a committed posting survives a primary election.
 */
@Global()
@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [CONFIG],
      useFactory: (config: AppConfiguration) => ({
        uri: config.mongo.uri,
        retryWrites: false,
        writeConcern: { w: 'majority' },
        readPreference: 'primary',
        serverSelectionTimeoutMS: 10_000,
        maxPoolSize: 50,
        minPoolSize: 5,
        autoIndex: !config.isProduction,
      }),
    }),
  ],
  providers: [TransactionManager],
  exports: [MongooseModule, TransactionManager],
})
export class DatabaseModule {}
