import type { Address, AssetRef, MoneyDto } from '@icb/contracts';
import { getScale, type CurrencyCode } from '@icb/money';

import { MAX_AMOUNT_MINOR_UNITS, MIN_AMOUNT_MINOR_UNITS } from '../testing.constants.js';
import type { FactoryContext } from '../core/context.js';

/** Money on the wire: integer minor units + the currency's declared scale (agent_plan.md N3). */
export function moneyDto(minorUnits: number, currency: CurrencyCode): MoneyDto {
  return { minorUnits, currency, scale: getScale(currency) };
}

export function zeroMoney(currency: CurrencyCode): MoneyDto {
  return moneyDto(0, currency);
}

/** A plausible non-zero amount a customer might move. */
export function randomMoney(ctx: FactoryContext, currency: CurrencyCode): MoneyDto {
  return moneyDto(ctx.intBetween(MIN_AMOUNT_MINOR_UNITS, MAX_AMOUNT_MINOR_UNITS), currency);
}

export function buildAddress(ctx: FactoryContext): Address {
  return {
    line1: ctx.faker.location.streetAddress(),
    city: ctx.faker.location.city(),
    region: 'Greater Accra',
    postalCode: ctx.faker.location.zipCode(),
    country: 'GH',
  };
}

/** A stored-asset reference in the shape KYC documents and avatars use. */
export function buildAssetRef(ctx: FactoryContext): AssetRef {
  return {
    provider: 'cloudinary',
    publicId: `icb-test/${ctx.nextId().toLowerCase()}`,
    resourceType: 'image',
    format: 'jpg',
    bytes: ctx.intBetween(50_000, 2_000_000),
    originalFilename: 'document.jpg',
    uploadedAt: ctx.clock.iso(),
  };
}

/** E.164 Ghana mobile, matching the contracts' phone schema. */
export function phoneNumber(ctx: FactoryContext): string {
  return `+233${ctx.digits(9)}`;
}

/** Domestic 10-digit account number. */
export function accountNumber(ctx: FactoryContext): string {
  return ctx.digits(10);
}

/** Sort code in the `NN-NN-NN` shape. */
export function sortCode(ctx: FactoryContext): string {
  return `${ctx.digits(2)}-${ctx.digits(2)}-${ctx.digits(2)}`;
}

/**
 * A MOD-97 valid GB IBAN. The check digits are computed for real so factories pass any
 * validation the API adds later, not just today's length check.
 */
export function iban(ctx: FactoryContext): string {
  const bban = `ICBK${sortCode(ctx).replaceAll('-', '')}${ctx.digits(8)}`;
  const rearranged = `${bban}GB00`;
  const remainder = mod97(rearranged);
  const checkDigits = String(98 - remainder).padStart(2, '0');
  return `GB${checkDigits}${bban}`;
}

const ASCII_LETTER_BASE = 55;
const MOD97_CHUNK = 9;

/** IBAN check: letters → digits (A=10…Z=35), then mod 97 in chunks to stay in safe integers. */
function mod97(alphanumeric: string): number {
  const digits = alphanumeric
    .split('')
    .map((char) => {
      const code = char.charCodeAt(0);
      return code >= 65 ? String(code - ASCII_LETTER_BASE) : char;
    })
    .join('');
  let remainder = 0;
  for (let index = 0; index < digits.length; index += MOD97_CHUNK) {
    remainder = Number(String(remainder) + digits.slice(index, index + MOD97_CHUNK)) % 97;
  }
  return remainder;
}
