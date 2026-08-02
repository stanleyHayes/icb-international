import { randomInt } from 'node:crypto';

import type { CardNetwork } from '@icb/contracts';

/**
 * Card number, CVV, expiry and ARN generation.
 *
 * The PAN carries a real Luhn check digit. That matters even in a simulation: every payment form,
 * every test harness and every card component in the front end validates Luhn before it will
 * accept a number, so a PAN that fails the check is a card that cannot be demonstrated.
 *
 * Randomness comes from `node:crypto`, not from the seeded simulation source — a card number must
 * not be reproducible from a seed the way a demo transaction is.
 */

const PAN_LENGTH = 16;
const CVV_LENGTH = 3;
const ARN_LENGTH = 23;
const EXPIRY_YEARS = 3;
const MS_PER_DAY = 86_400_000;

/** ICB's issuing BINs. Visa numbers begin with 4, Mastercard with 5 — as they do in reality. */
const NETWORK_BIN: Readonly<Record<CardNetwork, string>> = {
  visa: '424212',
  mastercard: '535312',
};

/** ICB's acquiring BIN, embedded in every acquirer reference number it generates. */
const ACQUIRER_BIN = '491703';

function randomDigits(count: number): string {
  let digits = '';
  for (let index = 0; index < count; index += 1) {
    digits += String(randomInt(0, 10));
  }
  return digits;
}

/**
 * Luhn's sum, read right to left. `doubleParity` says which positions get doubled: 0 when the
 * string has no check digit yet, 1 when it does.
 */
function luhnSum(digits: string, doubleParity: 0 | 1): number {
  let sum = 0;
  for (let index = 0; index < digits.length; index += 1) {
    const digit = Number(digits[digits.length - 1 - index]);
    const value = index % 2 === doubleParity ? digit * 2 : digit;
    sum += value > 9 ? value - 9 : value;
  }
  return sum;
}

/** The digit that, appended to `base`, makes the whole string Luhn-valid. */
export function luhnCheckDigit(base: string): number {
  return (10 - (luhnSum(base, 0) % 10)) % 10;
}

export function isLuhnValid(candidate: string): boolean {
  return /^\d+$/.test(candidate) && luhnSum(candidate, 1) % 10 === 0;
}

/** A 16-digit PAN on the network's BIN, ending in a valid Luhn check digit. */
export function generatePan(network: CardNetwork): string {
  const bin = NETWORK_BIN[network];
  const body = randomDigits(PAN_LENGTH - bin.length - 1);
  const base = `${bin}${body}`;
  return `${base}${luhnCheckDigit(base)}`;
}

export function generateCvv(): string {
  return randomDigits(CVV_LENGTH);
}

export function panLast4(pan: string): string {
  return pan.slice(-4);
}

/** Expiry is the last day of the month three years after issue, as printed on a real card. */
export function expiryFor(issuedAt: Date): { month: number; year: number } {
  return {
    month: issuedAt.getUTCMonth() + 1,
    year: issuedAt.getUTCFullYear() + EXPIRY_YEARS,
  };
}

/** A card expires at the *end* of its printed month, not at the start of it. */
export function isExpired(month: number, year: number, at: Date): boolean {
  const endOfExpiryMonth = Date.UTC(year, month, 1, 0, 0, 0, 0);
  return at.getTime() >= endOfExpiryMonth;
}

function dayOfYear(date: Date): number {
  const startOfYear = Date.UTC(date.getUTCFullYear(), 0, 0);
  const startOfDay = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.round((startOfDay - startOfYear) / MS_PER_DAY);
}

/**
 * A 23-digit acquirer reference number.
 *
 * This is the identifier a chargeback is raised against, so its structure is copied from the real
 * thing: a leading financial-institution digit, the acquiring BIN, the Julian date of processing,
 * a sequence, and a Luhn check digit.
 */
export function generateArn(processedAt: Date): string {
  const julian = `${processedAt.getUTCFullYear() % 10}${String(dayOfYear(processedAt)).padStart(3, '0')}`;
  const base = `2${ACQUIRER_BIN}${julian}${randomDigits(ARN_LENGTH - 12)}`;
  return `${base}${luhnCheckDigit(base)}`;
}
