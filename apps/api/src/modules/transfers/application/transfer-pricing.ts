import type { FxQuotesService } from '../../fx/fx-quotes.service.js';
import type { RailDispatchPort } from './rail-dispatch.port.js';

/** Injection token for the two pricing collaborators a transfer quote needs. */
export const TRANSFER_PRICING = Symbol('ICB_TRANSFER_PRICING');

/**
 * The quote service's pricing half, grouped.
 *
 * FX pricing and rail settlement estimates travel together because a transfer quote is exactly
 * the product of the two; grouping them keeps the service's constructor inside the dependency
 * limit without hiding a collaborator.
 */
export interface TransferPricing {
  readonly fxQuotes: FxQuotesService;
  readonly rails: RailDispatchPort;
}
