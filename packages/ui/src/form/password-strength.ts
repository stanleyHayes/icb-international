/**
 * Password strength scoring for {@link PasswordInput}.
 *
 * Deterministic and offline — no zxcvbn-style dictionary download. Length and character-class
 * breadth raise the score; repeats and keyboard walks lower it. The same pure function feeds
 * the meter and the tests, so the UI can never drift from the policy.
 */

export const PASSWORD_STRENGTH_LEVELS = [
  'very-weak',
  'weak',
  'fair',
  'strong',
  'very-strong',
] as const;

export type PasswordStrengthLevel = (typeof PASSWORD_STRENGTH_LEVELS)[number];

export const PASSWORD_STRENGTH_LABELS: Readonly<Record<PasswordStrengthLevel, string>> = {
  'very-weak': 'Very weak',
  weak: 'Weak',
  fair: 'Fair',
  strong: 'Strong',
  'very-strong': 'Very strong',
};

export interface PasswordStrength {
  /** 0–4, indexing {@link PASSWORD_STRENGTH_LEVELS}. */
  readonly score: number;
  readonly level: PasswordStrengthLevel;
  readonly label: string;
}

const MIN_STRONG_LENGTH = 12;
const MIN_FAIR_LENGTH = 8;
const SHORT_PASSWORD_CAP = 6;
const SEQUENCE_WINDOW = 4;

const CHARACTER_CLASS_PATTERNS = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/] as const;
const REPEATED_CHARACTER = /(.)\1{2,}/;
const KEYBOARD_WALKS = ['abcdefghijklmnopqrstuvwxyz', '0123456789', 'qwertyuiop', 'asdfghjkl'] as const;

function countCharacterClasses(password: string): number {
  return CHARACTER_CLASS_PATTERNS.filter((pattern) => pattern.test(password)).length;
}

function hasKeyboardWalk(password: string): boolean {
  const lowered = password.toLowerCase();
  return KEYBOARD_WALKS.some((walk) => {
    const reversed = [...walk].reverse().join('');
    for (let i = 0; i + SEQUENCE_WINDOW <= lowered.length; i += 1) {
      const window = lowered.slice(i, i + SEQUENCE_WINDOW);
      if (walk.includes(window) || reversed.includes(window)) {
        return true;
      }
    }
    return false;
  });
}

function clampScore(score: number): number {
  return Math.min(Math.max(score, 0), PASSWORD_STRENGTH_LEVELS.length - 1);
}

/** Score a password from 0 (very weak) to 4 (very strong). */
export function scorePassword(password: string): PasswordStrength {
  if (password.length === 0) {
    return toStrength(0);
  }
  let score = 0;
  if (password.length >= MIN_FAIR_LENGTH) score += 1;
  if (password.length >= MIN_STRONG_LENGTH) score += 1;
  const classes = countCharacterClasses(password);
  if (classes >= 3) score += 1;
  if (classes === CHARACTER_CLASS_PATTERNS.length) score += 1;
  if (password.length < SHORT_PASSWORD_CAP) score = Math.min(score, 1);
  if (REPEATED_CHARACTER.test(password) || hasKeyboardWalk(password)) score -= 1;
  return toStrength(clampScore(score));
}

function toStrength(score: number): PasswordStrength {
  const level = PASSWORD_STRENGTH_LEVELS[score] ?? 'very-weak';
  return { score, level, label: PASSWORD_STRENGTH_LABELS[level] };
}
