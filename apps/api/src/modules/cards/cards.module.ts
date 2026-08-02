import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AccountsModule } from '../accounts/accounts.module.js';
import {
  CustomerDoc,
  CustomerSchema,
} from '../customers/infrastructure/customer.schemas.js';
import { LedgerModule } from '../ledger/ledger.module.js';
import { CardAuthorisationLogService } from './application/card-authorisation-log.service.js';
import { CardAuthorisationService } from './application/card-authorisation.service.js';
import { CardCaptureService } from './application/card-capture.service.js';
import { CardIssuanceService } from './application/card-issuance.service.js';
import { CardReader } from './application/card-reader.js';
import { CardSecurityService } from './application/card-security.service.js';
import { CardSettingsService } from './application/card-settings.service.js';
import { CardSpendService } from './application/card-spend.service.js';
import { CardNetworkController } from './card-network.controller.js';
import { CardSettingsController } from './card-settings.controller.js';
import { CardsController } from './cards.controller.js';
import { CardsService } from './cards.service.js';
import {
  CardAuthorisationDoc,
  CardAuthorisationSchema,
} from './infrastructure/card-authorisation.schemas.js';
import { CardDoc, CardSchema } from './infrastructure/card.schemas.js';

/**
 * Cards.
 *
 * LedgerModule supplies both halves of the money story — `HoldService` for the reservation an
 * authorisation places and `LedgerService` for the posting a capture makes — and AccountsModule
 * supplies the ownership and available-balance checks. Nothing here touches a balance directly.
 *
 * `PasswordService` and `TokenService` arrive through the global AuthModule, so PIN hashing and
 * step-up verification use the same primitives as login rather than a second implementation.
 */
@Module({
  imports: [
    LedgerModule,
    AccountsModule,
    MongooseModule.forFeature([
      { name: CardDoc.name, schema: CardSchema },
      { name: CardAuthorisationDoc.name, schema: CardAuthorisationSchema },
      { name: CustomerDoc.name, schema: CustomerSchema },
    ]),
  ],
  controllers: [CardsController, CardSettingsController, CardNetworkController],
  providers: [
    CardsService,
    CardReader,
    CardSpendService,
    CardIssuanceService,
    CardSettingsService,
    CardSecurityService,
    CardAuthorisationService,
    CardAuthorisationLogService,
    CardCaptureService,
  ],
  exports: [CardsService, CardAuthorisationService, CardCaptureService, CardAuthorisationLogService],
})
export class CardsModule {}
