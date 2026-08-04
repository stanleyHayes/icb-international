import { vi } from 'vitest';

import type { MetricsService } from '../metrics.service.js';

/**
 * A MetricsService whose every method is a spy.
 *
 * Metrics are injected into services that a unit test constructs by hand, so each of those tests
 * would otherwise carry its own throwaway stub — and every new counter would break all of them at
 * once. One factory here means adding a metric touches one file.
 *
 * Every method is present so a test can assert on the one it cares about; the rest stay silent
 * rather than throwing "not a function" from a code path the test was not written to exercise.
 */
export function metricsStub(): MetricsService {
  return {
    render: vi.fn().mockResolvedValue(''),
    contentType: vi.fn().mockReturnValue('text/plain'),
    httpRequest: vi.fn(),
    ledgerPosting: vi.fn(),
    transferOutcome: vi.fn(),
    fraudDecision: vi.fn(),
    endOfDayRun: vi.fn(),
    queueDepth: vi.fn(),
    deadLetterQueueSize: vi.fn(),
    ledgerDrift: vi.fn(),
  } as unknown as MetricsService;
}
