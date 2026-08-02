import argon2 from 'argon2';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { COMMON_PASSWORDS } from '../auth.constants.js';
import { DomainError } from '../../../common/errors/domain.error.js';

/**
 * Password hashing and policy.
 *
 * Argon2id with parameters chosen for ~100ms on commodity hardware: expensive enough that an
 * offline attack on a leaked hash is impractical, cheap enough that login stays responsive.
 */
const ARGON_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65_536, // 64 MiB
  timeCost: 3,
  parallelism: 4,
} as const;

@Injectable()
export class PasswordService {
  async hash(plaintext: string): Promise<string> {
    return argon2.hash(plaintext, ARGON_OPTIONS);
  }

  /**
   * Verify a password. Returns false rather than throwing on a malformed stored hash — a
   * corrupted record must not become an authentication bypass or a 500 that leaks its existence.
   */
  async verify(hash: string, plaintext: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plaintext);
    } catch {
      return false;
    }
  }

  /**
   * Reject passwords that appear in the breached-password list.
   *
   * This catches far more real-world compromise than any composition rule: an attacker's first
   * few thousand guesses are exactly this list.
   */
  assertNotBreached(plaintext: string): void {
    if (COMMON_PASSWORDS.has(plaintext.toLowerCase())) {
      throw new DomainError(
        'PASSWORD_POLICY_VIOLATION',
        'This password has appeared in known data breaches. Please choose another.',
      );
    }
  }

  /** A single-use token for email verification or password reset. Returned once, stored hashed. */
  createToken(): { token: string; hash: string } {
    const token = randomBytes(32).toString('base64url');
    return { token, hash: this.hashToken(token) };
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /** Constant-time comparison so a token cannot be recovered by timing the failure. */
  tokensMatch(candidateHash: string, storedHash: string): boolean {
    const candidate = Buffer.from(candidateHash, 'hex');
    const stored = Buffer.from(storedHash, 'hex');
    return candidate.length === stored.length && timingSafeEqual(candidate, stored);
  }

  /** Recovery codes are shown once at enrolment and stored only as hashes. */
  createRecoveryCodes(count = 10): { codes: string[]; hashes: string[] } {
    const codes = Array.from({ length: count }, () =>
      randomBytes(5).toString('hex').toUpperCase().match(/.{1,5}/g)?.join('-') ?? '',
    );
    return { codes, hashes: codes.map((code) => this.hashToken(code)) };
  }
}
