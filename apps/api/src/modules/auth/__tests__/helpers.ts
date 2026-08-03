import { vi } from 'vitest';

import { ClockService } from '../../../simulation/clock/clock.service.js';
import type { AuditPort } from '../application/audit.port.js';

export const TEST_NOW = new Date('2026-08-02T12:00:00.000Z');

/** A mongoose query tail: `model.findOne(...)` returns this and `.lean()` resolves the value. */
export function leanQuery<T>(value: T): { lean: ReturnType<typeof vi.fn> } {
  return { lean: vi.fn().mockResolvedValue(value) };
}

export function frozenClock(instant: Date = TEST_NOW): ClockService {
  const clock = new ClockService();
  clock.freeze(instant);
  return clock;
}

export interface MockAudit {
  readonly record: ReturnType<typeof vi.fn>;
}

export function mockAudit(): MockAudit {
  return { record: vi.fn().mockResolvedValue(undefined) };
}

export function asAudit(audit: MockAudit): AuditPort {
  return audit as unknown as AuditPort;
}
