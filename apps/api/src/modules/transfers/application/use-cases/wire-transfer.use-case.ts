import { Inject, Injectable } from '@nestjs/common';

import { LedgerService } from '../../../ledger/ledger.service.js';
import { FxConversionService } from '../../../fx/fx-conversion.service.js';
import { RAIL_DISPATCH_PORT, type RailDispatchPort } from '../rail-dispatch.port.js';
import { ExternalRailTransferUseCase } from './external-rail-transfer.base.js';

/**
 * Domestic wire.
 *
 * Same-day value before the 16:00 cut-off, next business day after it — the rail adapter's
 * profile carries the cut-off, and its settlement arithmetic is what `estimatedArrival` reports.
 */
@Injectable()
export class WireTransferUseCase extends ExternalRailTransferUseCase {
  readonly rail = 'wire' as const;

  constructor(
    ledger: LedgerService,
    fxConversion: FxConversionService,
    @Inject(RAIL_DISPATCH_PORT) rails: RailDispatchPort,
  ) {
    super(ledger, fxConversion, rails);
  }
}
