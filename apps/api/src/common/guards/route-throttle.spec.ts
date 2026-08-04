import 'reflect-metadata';

import { describe, expect, it } from 'vitest';

import { AuthController } from '../../modules/auth/auth.controller.js';
import { TransfersController } from '../../modules/transfers/transfers.controller.js';
import {
  AUTH_THROTTLE_LIMIT,
  MONEY_MOVEMENT_THROTTLE_LIMIT,
  THROTTLE_LIMIT,
  THROTTLE_WINDOW_MS,
} from './throttle.constants.js';

// @nestjs/throttler v6 stores per-route policy as Reflect metadata on the handler, keyed by
// throttler name ('default'). Reading it back proves the decorator wiring without booting Nest.
const LIMIT_KEY = 'THROTTLER:LIMITdefault';
const TTL_KEY = 'THROTTLER:TTLdefault';

type Handler = (...args: never[]) => unknown;
type ControllerClass = new (...args: never[]) => unknown;

/** Reads the handler without an unbound method reference (descriptor access, not dot access). */
function handlerOf(controller: ControllerClass, method: string): Handler {
  const descriptor = Object.getOwnPropertyDescriptor(controller.prototype, method);
  if (descriptor === undefined) {
    throw new Error(`No handler named ${method}`);
  }
  return descriptor.value as Handler;
}

function throttleOf(handler: Handler): { limit: unknown; ttl: unknown } {
  return {
    limit: Reflect.getMetadata(LIMIT_KEY, handler) as unknown,
    ttl: Reflect.getMetadata(TTL_KEY, handler) as unknown,
  };
}

describe('per-route throttles', () => {
  it('sizes the global policy at 120 requests per minute', () => {
    expect(THROTTLE_LIMIT).toBe(120);
    expect(THROTTLE_WINDOW_MS).toBe(60_000);
  });

  it.each(['register', 'login', 'verifyMfa', 'refresh'] as const)(
    'caps auth %s at 5 per minute',
    (method) => {
      expect(throttleOf(handlerOf(AuthController, method))).toEqual({
        limit: AUTH_THROTTLE_LIMIT,
        ttl: THROTTLE_WINDOW_MS,
      });
      expect(AUTH_THROTTLE_LIMIT).toBe(5);
    },
  );

  it.each(['create', 'createBulk'] as const)('caps transfer %s at 10 per minute', (method) => {
    expect(throttleOf(handlerOf(TransfersController, method))).toEqual({
      limit: MONEY_MOVEMENT_THROTTLE_LIMIT,
      ttl: THROTTLE_WINDOW_MS,
    });
    expect(MONEY_MOVEMENT_THROTTLE_LIMIT).toBe(10);
  });

  it('leaves non-credential auth routes on the global limit', () => {
    // Logout and /me carry no credential guess surface; overriding them would punish sessions.
    for (const method of ['logout', 'logoutEverywhere', 'me'] as const) {
      expect(throttleOf(handlerOf(AuthController, method)).limit).toBeUndefined();
    }
  });

  it('leaves read-only and non-posting transfer routes on the global limit', () => {
    for (const method of ['quote', 'list', 'detail', 'cancel'] as const) {
      expect(throttleOf(handlerOf(TransfersController, method)).limit).toBeUndefined();
    }
  });
});
