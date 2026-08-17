import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';

import { buildLoggerConfig } from './common/observability/logger.config.js';
import { MetricsModule } from './common/observability/metrics.module.js';

import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { ThrottleGuard } from './common/guards/throttle.guard.js';
import { THROTTLE_LIMIT, THROTTLE_WINDOW_MS } from './common/guards/throttle.constants.js';
import { IdempotencyInterceptor } from './common/interceptors/idempotency.interceptor.js';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor.js';
import { TimingInterceptor } from './common/interceptors/timing.interceptor.js';
import { ConfigModule } from './config/config.module.js';
import { CONFIG, type AppConfiguration } from './config/configuration.js';
import { DatabaseModule } from './infrastructure/database/database.module.js';
import { IdempotencyModule } from './infrastructure/idempotency/idempotency.module.js';
import { OutboxModule } from './infrastructure/outbox/outbox.module.js';
import { ClockModule } from './simulation/clock/clock.module.js';

// ─── DOMAIN MODULES ─── kept alphabetical so appends never conflict ───
import { AccountsModule } from './modules/accounts/accounts.module.js';
import { AccrualsModule } from './modules/accruals/accruals.module.js';
import { AdminModule } from './modules/admin/admin.module.js';
import { AmlModule } from './modules/aml/aml.module.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { BeneficiariesModule } from './modules/beneficiaries/beneficiaries.module.js';
import { BillingModule } from './modules/billing/billing.module.js';
import { BudgetsModule } from './modules/budgets/budgets.module.js';
import { CardsModule } from './modules/cards/cards.module.js';
import { ChatModule } from './modules/chat/chat.module.js';
import { ContentModule } from './modules/content/content.module.js';
import { CustomersModule } from './modules/customers/customers.module.js';
import { DocumentsModule } from './modules/documents/documents.module.js';
import { DisputesModule } from './modules/disputes/disputes.module.js';
import { FxModule } from './modules/fx/fx.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { IamModule } from './modules/iam/iam.module.js';
import { KycModule } from './modules/kyc/kyc.module.js';
import { LedgerModule } from './modules/ledger/ledger.module.js';
import { LoansModule } from './modules/loans/loans.module.js';
import { MediaModule } from './modules/media/media.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { ProductsModule } from './modules/products/products.module.js';
import { RiskModule } from './modules/risk/risk.module.js';
import { SavingsModule } from './modules/savings/savings.module.js';
import { SimulationModule } from './modules/simulation/simulation.module.js';
import { SeedModule } from './simulation/seed/seed.module.js';
import { SupportModule } from './modules/support/support.module.js';
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
    LoggerModule.forRootAsync({
      inject: [CONFIG],
      useFactory: (config: AppConfiguration) => buildLoggerConfig(config),
    }),
    DatabaseModule,
    ClockModule,
    IdempotencyModule,
    MetricsModule,
    OutboxModule,
    ThrottlerModule.forRoot([{ ttl: THROTTLE_WINDOW_MS, limit: THROTTLE_LIMIT }]),
    // ─── DOMAIN MODULES ───
    AccountsModule,
    AccrualsModule,
    AdminModule,
    AmlModule,
    AuditModule,
    AuthModule,
    BeneficiariesModule,
    BillingModule,
    BudgetsModule,
    CardsModule,
    ChatModule,
    ContentModule,
    CustomersModule,
    DisputesModule,
    DocumentsModule,
    FxModule,
    HealthModule,
    IamModule,
    KycModule,
    LedgerModule,
    LoansModule,
    MediaModule,
    NotificationsModule,
    ProductsModule,
    RiskModule,
    SavingsModule,
    SeedModule,
    SimulationModule,
    SupportModule,
    TransactionsModule,
    TransfersModule,
    // ─── END DOMAIN MODULES ───
  ],
  providers: [
    // Guards run in registration order: authentication first, so the throttler tracks the
    // authenticated subject rather than the IP when a token is present.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ThrottleGuard },
    // Interceptors wrap in registration order: logging outermost, idempotency closest to the
    // handler, so a replayed response is still logged and timed.
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TimingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
  ],
})
export class AppModule {}
