/**
 * The default country calling codes offered by {@link PhoneInput}.
 *
 * Curated to the markets ICB operates in plus the largest remittance corridors. Apps pass their
 * own `codes` list when a flow needs a different set — this is a default, not a constraint.
 */

export interface DialingCode {
  readonly country: string;
  /** ISO 3166-1 alpha-2, used as the option key. */
  readonly iso: string;
  /** Country calling code without the leading `+`. */
  readonly dialCode: string;
}

export const DEFAULT_DIALING_CODES: readonly DialingCode[] = [
  { country: 'Ghana', iso: 'GH', dialCode: '233' },
  { country: 'Nigeria', iso: 'NG', dialCode: '234' },
  { country: 'Kenya', iso: 'KE', dialCode: '254' },
  { country: 'South Africa', iso: 'ZA', dialCode: '27' },
  { country: 'United Kingdom', iso: 'GB', dialCode: '44' },
  { country: 'United States', iso: 'US', dialCode: '1' },
  { country: 'Canada', iso: 'CA', dialCode: '1' },
  { country: 'Ireland', iso: 'IE', dialCode: '353' },
  { country: 'Germany', iso: 'DE', dialCode: '49' },
  { country: 'France', iso: 'FR', dialCode: '33' },
  { country: 'Netherlands', iso: 'NL', dialCode: '31' },
  { country: 'Spain', iso: 'ES', dialCode: '34' },
  { country: 'United Arab Emirates', iso: 'AE', dialCode: '971' },
  { country: 'India', iso: 'IN', dialCode: '91' },
  { country: 'China', iso: 'CN', dialCode: '86' },
  { country: 'Japan', iso: 'JP', dialCode: '81' },
  { country: 'Australia', iso: 'AU', dialCode: '61' },
];

/** E.164 bounds: country code + subscriber number, digits only. */
export const E164_MIN_DIGITS = 7;
export const E164_MAX_DIGITS = 15;
