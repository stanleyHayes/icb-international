import type { MoneyDto } from '@icb/contracts';
import { getScale, type CurrencyCode } from '@icb/money';

/**
 * Integer minor units → wire shape (agent_plan.md N3).
 *
 * Lives in the ledger module so the core never imports a mapper from a product module built on
 * top of it — dependencies point inward, toward the ledger.
 */
export function toMoneyDto(minorUnits: number, currency: string): MoneyDto {
  return {
    minorUnits,
    currency: currency as MoneyDto['currency'],
    scale: getScale(currency as CurrencyCode),
  };
}
