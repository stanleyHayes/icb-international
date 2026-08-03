import { Inject, Injectable } from '@nestjs/common';

import { LedgerService } from '../../../ledger/ledger.service.js';
import { FxConversionService } from '../../../fx/fx-conversion.service.js';
import { RAIL_DISPATCH_PORT, type RailDispatchPort } from '../rail-dispatch.port.js';
import { ExternalRailTransferUseCase } from './external-rail-transfer.base.js';

/**
 * SWIFT cross-border.
 *
 * T+2 with correspondent hops, addressed by IBAN and BIC. Cross-currency instructions arrive
 * here with their FX terms already fixed by the quote the customer redeemed — the conversion
 * legs are built by the FX module, never by this class.
 */
@Injectable()
export class SwiftTransferUseCase extends ExternalRailTransferUseCase {
  readonly rail = 'swift' as const;

  constructor(
    ledger: LedgerService,
    fxConversion: FxConversionService,
    @Inject(RAIL_DISPATCH_PORT) rails: RailDispatchPort,
  ) {
    super(ledger, fxConversion, rails);
  }
}
