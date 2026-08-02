import { DomainError } from '../../../common/errors/index.js';

/**
 * PIN policy.
 *
 * Four digits gives ten thousand combinations, and roughly a quarter of real customers pick from
 * the same few hundred: repeats, runs, and repeated pairs. Rejecting those is worth more than any
 * additional length would be, because the attack on a PIN is three guesses at a cash machine, not
 * an offline search.
 */

const PIN_LENGTH = 4;

function digitsOf(pin: string): number[] {
  return [...pin].map(Number);
}

/** `1234` and `9876` — each digit one step from the last, wrapping through zero. */
function isRun(digits: readonly number[], step: number): boolean {
  for (let index = 1; index < digits.length; index += 1) {
    const previous = digits[index - 1] ?? 0;
    if (digits[index] !== (previous + step + 10) % 10) {
      return false;
    }
  }
  return true;
}

/** `1212`, `4545` — two digits alternating, which people choose because they are easy to tap. */
function isAlternating(digits: readonly number[]): boolean {
  return digits.length === PIN_LENGTH && digits[0] === digits[2] && digits[1] === digits[3];
}

export function isTrivialPin(pin: string): boolean {
  const digits = digitsOf(pin);
  return (
    new Set(digits).size === 1 || isRun(digits, 1) || isRun(digits, -1) || isAlternating(digits)
  );
}

export function assertPinAllowed(pin: string): void {
  if (!/^\d{4}$/.test(pin)) {
    throw new DomainError('PIN_POLICY_VIOLATION', 'A PIN must be exactly four digits');
  }
  if (isTrivialPin(pin)) {
    throw new DomainError(
      'PIN_POLICY_VIOLATION',
      'That PIN is too easy to guess. Avoid repeated digits, runs, and repeating pairs.',
    );
  }
}
