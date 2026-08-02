import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { ConfigModule } from './config/config.module.js';
import { DatabaseModule } from './infrastructure/database/database.module.js';
import { ClockModule } from './simulation/clock/clock.module.js';

// ─── DOMAIN MODULES ─── agents append one import + one module ref, alphabetically ───
import { AccountsModule } from './modules/accounts/accounts.module.js';
import { AdminModule } from './modules/admin/admin.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CacheModule } from './infrastructure/cache/cache.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { LedgerModule } from './modules/ledger/ledger.module.js';
import { OutboxModule } from './infrastructure/outbox/outbox.module.js';
import { QueueModule } from './infrastructure/queue/queue.module.js';
import { SeedModule } from './simulation/seed/seed.module.js';
import { TransactionsModule } from './modules/transactions/transactions.module.js';
import { TransfersModule } from './modules/transfers/transfers.module.js';
// ─── END DOMAIN MODULES ───

/**
 * Composition root.
 *
 * Authentication is bound as a global guard, so every route is protected unless it carries
 * `@Public()`. Ordering matters only for the infrastructure modules: configuration must parse
 * before the database knows where to connect, and the clock must exist before anything reads
 * time.
 */
@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    ClockModule,
    // ─── DOMAIN MODULES ───
    AccountsModule,
    AdminModule,
    AuthModule,
    CacheModule,
    HealthModule,
    LedgerModule,
    OutboxModule,
    QueueModule,
    SeedModule,
    TransactionsModule,
    TransfersModule,
    // ─── END DOMAIN MODULES ───
  ],
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
