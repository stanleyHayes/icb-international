import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AccountsModule } from '../accounts/accounts.module.js';
import { BeneficiariesModule } from '../beneficiaries/beneficiaries.module.js';
import { FxModule } from '../fx/fx.module.js';
import { FxQuotesService } from '../fx/fx-quotes.service.js';
import { LedgerModule } from '../ledger/ledger.module.js';
import { RiskModule } from '../risk/risk.module.js';
import { SimulationModule } from '../simulation/simulation.module.js';
import { BulkTransfersService } from './application/bulk-transfers.service.js';
import { DestinationResolver } from './application/destination-resolver.js';
import { DueTransfersProcessor } from './application/due-transfers.processor.js';
import { FRAUD_CHECK_PORT } from './application/fraud-check.port.js';
import { RAIL_DISPATCH_PORT } from './application/rail-dispatch.port.js';
import { RegistryRailDispatchAdapter } from './application/registry-rail-dispatch.adapter.js';
import { RiskFraudCheckAdapter } from './application/risk-fraud-check.adapter.js';
import { ScheduledTransfersExecutor } from './application/scheduled-transfers.executor.js';
import { StandingOrdersService } from './application/standing-orders.service.js';
import { TransferOrchestrator } from './application/transfer-orchestrator.js';
import { TransferPreparationService } from './application/transfer-preparation.service.js';
import { TRANSFER_PRICING } from './application/transfer-pricing.js';
import { TransferQuotesService } from './application/transfer-quotes.service.js';
import { TransferTemplatesService } from './application/transfer-templates.service.js';
import { AchTransferUseCase } from './application/use-cases/ach-transfer.use-case.js';
import { InternalTransferUseCase } from './application/use-cases/internal-transfer.use-case.js';
import { OnUsTransferUseCase } from './application/use-cases/on-us-transfer.use-case.js';
import { RAIL_USE_CASES } from './application/use-cases/rail-transfer.use-case.js';
import { SwiftTransferUseCase } from './application/use-cases/swift-transfer.use-case.js';
import { WireTransferUseCase } from './application/use-cases/wire-transfer.use-case.js';
import {
  TransferQuoteDoc,
  TransferQuoteSchema,
} from './infrastructure/transfer-quote.schemas.js';
import {
  TransferTemplateDoc,
  TransferTemplateSchema,
} from './infrastructure/transfer-template.schemas.js';
import { TransferDoc, TransferSchema } from './infrastructure/transfer.schemas.js';
import {
  StandingOrderDoc,
  StandingOrderSchema,
} from './infrastructure/standing-order.schemas.js';
import { StandingOrdersController } from './standing-orders.controller.js';
import { TransferTemplatesController } from './transfer-templates.controller.js';
import { TransfersController } from './transfers.controller.js';
import { TransfersService } from './transfers.service.js';

/**
 * Customer money movement.
 *
 * The module wires the pipeline: the orchestrator runs the common steps, one use-case per rail
 * owns the destination leg, and the ports bind the risk engine and the simulated rails. Rail
 * behaviour itself stays in `simulation/rails` (N2) — this module only consumes it through
 * `RAIL_DISPATCH_PORT`. `TransfersService` is exported for the simulation seed and scenarios.
 */
@Module({
  imports: [
    LedgerModule,
    AccountsModule,
    BeneficiariesModule,
    FxModule,
    RiskModule,
    SimulationModule,
    MongooseModule.forFeature([
      { name: TransferDoc.name, schema: TransferSchema },
      { name: TransferQuoteDoc.name, schema: TransferQuoteSchema },
      { name: TransferTemplateDoc.name, schema: TransferTemplateSchema },
      { name: StandingOrderDoc.name, schema: StandingOrderSchema },
    ]),
  ],
  controllers: [TransfersController, TransferTemplatesController, StandingOrdersController],
  providers: [
    TransfersService,
    TransferOrchestrator,
    TransferPreparationService,
    TransferQuotesService,
    BulkTransfersService,
    TransferTemplatesService,
    StandingOrdersService,
    ScheduledTransfersExecutor,
    DueTransfersProcessor,
    DestinationResolver,
    InternalTransferUseCase,
    OnUsTransferUseCase,
    AchTransferUseCase,
    WireTransferUseCase,
    SwiftTransferUseCase,
    {
      provide: RAIL_USE_CASES,
      useFactory: (
        internal: InternalTransferUseCase,
        onUs: OnUsTransferUseCase,
        ach: AchTransferUseCase,
        wire: WireTransferUseCase,
        swift: SwiftTransferUseCase,
      ) => [internal, onUs, ach, wire, swift],
      inject: [
        InternalTransferUseCase,
        OnUsTransferUseCase,
        AchTransferUseCase,
        WireTransferUseCase,
        SwiftTransferUseCase,
      ],
    },
    { provide: FRAUD_CHECK_PORT, useClass: RiskFraudCheckAdapter },
    { provide: RAIL_DISPATCH_PORT, useClass: RegistryRailDispatchAdapter },
    {
      provide: TRANSFER_PRICING,
      useFactory: (fxQuotes: FxQuotesService, rails: RegistryRailDispatchAdapter) => ({
        fxQuotes,
        rails,
      }),
      inject: [FxQuotesService, RAIL_DISPATCH_PORT],
    },
  ],
  exports: [TransfersService, TransferOrchestrator],
})
export class TransfersModule {}
