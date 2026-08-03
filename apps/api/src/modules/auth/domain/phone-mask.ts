/**
 * Phone masking for MFA hints.
 *
 * The challenge response tells the customer *where* a code was sent without telling an attacker
 * anything they did not already know: country code and the final digits only, e.g.
 * `+233 ** *** 4521`.
 */
const COUNTRY_CODE_LENGTH = 4;
const VISIBLE_TAIL_LENGTH = 4;

export function maskPhone(phone: string): string {
  const compact = phone.replace(/[\s-]+/g, '');
  const tail = compact.slice(-VISIBLE_TAIL_LENGTH);
  const country = compact.startsWith('+') ? compact.slice(0, COUNTRY_CODE_LENGTH) : '';
  return `${country} ** *** ${tail}`.trim();
}
