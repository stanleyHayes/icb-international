import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';

import { buildLoggerConfig } from './common/observability/logger.config.js';

import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { ConfigModule } from './config/config.module.js';
import { CONFIG, type AppConfiguration } from './config/configuration.js';
import { DatabaseModule } from './infrastructure/database/database.module.js';
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
import { CardsModule } from './modules/cards/cards.module.js';
import { CustomersModule } from './modules/customers/customers.module.js';
import { DocumentsModule } from './modules/documents/documents.module.js';
import { DisputesModule } from './modules/disputes/disputes.module.js';
import { FxModule } from './modules/fx/fx.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { IamModule } from './modules/iam/iam.module.js';
import { KycModule } from './modules/kyc/kyc.module.js';
import { LedgerModule } from './modules/ledger/ledger.module.js';
import { LoansModule } from './modules/loans/loans.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { ProductsModule } from './modules/products/products.module.js';
import { RiskModule } from './modules/risk/risk.module.js';
import { SavingsModule } from './modules/savings/savings.module.js';
import { SimulationModule } from './modules/simulation/simulation.module.js';
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
    LoggerModule.forRootAsync({
      inject: [CONFIG],
      useFactory: (config: AppConfiguration) => buildLoggerConfig(config),
    }),
    DatabaseModule,
    ClockModule,
    // ─── DOMAIN MODULES ───
    AccountsModule,
    AccrualsModule,
    AdminModule,
    AmlModule,
    AuditModule,
    AuthModule,
    BeneficiariesModule,
    BillingModule,
    CardsModule,
    CustomersModule,
    DisputesModule,
    DocumentsModule,
    FxModule,
    HealthModule,
    IamModule,
    KycModule,
    LedgerModule,
    LoansModule,
    NotificationsModule,
    ProductsModule,
    RiskModule,
    SavingsModule,
    SeedModule,
    SimulationModule,
    TransactionsModule,
    TransfersModule,
    // ─── END DOMAIN MODULES ───
  ],
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
