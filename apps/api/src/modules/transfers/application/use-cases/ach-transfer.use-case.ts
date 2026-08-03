import { Inject, Injectable } from '@nestjs/common';

import { LedgerService } from '../../../ledger/ledger.service.js';
import { FxConversionService } from '../../../fx/fx-conversion.service.js';
import { RAIL_DISPATCH_PORT, type RailDispatchPort } from '../rail-dispatch.port.js';
import { ExternalRailTransferUseCase } from './external-rail-transfer.base.js';

/**
 * Automated Clearing House.
 *
 * A batch rail: acceptance means the entry passed format edits, not that the money arrived —
 * settlement lands the next banking day, which the rail adapter computes. The use-case adds
 * nothing to the shared outbound behaviour; it exists so the pipeline names the rail it ran.
 */
@Injectable()
export class AchTransferUseCase extends ExternalRailTransferUseCase {
  readonly rail = 'ach' as const;

  constructor(
    ledger: LedgerService,
    fxConversion: FxConversionService,
    @Inject(RAIL_DISPATCH_PORT) rails: RailDispatchPort,
  ) {
    super(ledger, fxConversion, rails);
  }
}
