/**
 * Account number and IBAN generation.
 *
 * Both carry real check digits. A simulated bank whose IBANs fail MOD-97 validation would be
 * rejected by every real validator a developer might point at it, which defeats the purpose of
 * behaving exactly like a bank.
 */

const ACCOUNT_NUMBER_LENGTH = 10;

/**
 * Ten-digit domestic account number with a Luhn check digit in the final position.
 *
 * @param entropy Injected so seeded data is reproducible (agent_plan.md SIM-04).
 */
export function generateAccountNumber(entropy: () => number = Math.random): string {
  let body = '';
  for (let index = 0; index < ACCOUNT_NUMBER_LENGTH - 1; index += 1) {
    body += Math.floor(entropy() * 10).toString();
  }
  return body + luhnCheckDigit(body);
}

export function luhnCheckDigit(body: string): string {
  let sum = 0;
  let double = true;

  for (let index = body.length - 1; index >= 0; index -= 1) {
    let digit = Number(body[index]);
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }

  return ((10 - (sum % 10)) % 10).toString();
}

export function isValidAccountNumber(value: string): boolean {
  if (!/^\d{10}$/.test(value)) return false;
  return luhnCheckDigit(value.slice(0, -1)) === value.slice(-1);
}

const LETTER_OFFSET = 'A'.charCodeAt(0);

/** Letters convert to two-digit numbers: A=10 … Z=35. */
function toNumericIban(value: string): string {
  return value
    .split('')
    .map((character) =>
      /[A-Z]/.test(character)
        ? (character.charCodeAt(0) - LETTER_OFFSET + 10).toString()
        : character,
    )
    .join('');
}

/** MOD-97-10 over a string too long for Number, computed in chunks. */
function mod97(numeric: string): number {
  let remainder = 0;
  for (const digit of numeric) {
    remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder;
}

/**
 * Build a MOD-97 valid IBAN.
 *
 * @param countryCode ISO 3166-1 alpha-2, e.g. `GH`.
 * @param bankCode    ICB's institution code within that country.
 * @param accountNumber The domestic account number.
 */
export function generateIban(
  countryCode: string,
  bankCode: string,
  accountNumber: string,
): string {
  const bban = `${bankCode}${accountNumber}`.toUpperCase();
  // Check digits are computed with the country code and "00" rotated to the end.
  const rearranged = toNumericIban(`${bban}${countryCode.toUpperCase()}00`);
  const checkDigits = (98 - mod97(rearranged)).toString().padStart(2, '0');
  return `${countryCode.toUpperCase()}${checkDigits}${bban}`;
}

export function isValidIban(iban: string): boolean {
  const normalised = iban.replaceAll(' ', '').toUpperCase();
  if (normalised.length < 15 || normalised.length > 34) return false;
  const rearranged = toNumericIban(normalised.slice(4) + normalised.slice(0, 4));
  return mod97(rearranged) === 1;
}

/** Group into fours for display: `GH29 ICBK 6016 1331 9268 19`. */
export function formatIban(iban: string): string {
  return iban.replaceAll(' ', '').toUpperCase().replace(/(.{4})/g, '$1 ').trim();
}
