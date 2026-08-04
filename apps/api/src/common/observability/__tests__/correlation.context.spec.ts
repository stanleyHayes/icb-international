import { describe, expect, it } from 'vitest';

import {
  currentCorrelationId,
  enterWithCorrelation,
  runWithCorrelation,
} from '../correlation.context.js';

describe('correlation context', () => {
  it('is null outside any scope', () => {
    expect(currentCorrelationId()).toBeNull();
  });

  it('runWithCorrelation scopes the id to the work, including async continuations', async () => {
    const seen = await runWithCorrelation('corr-run', async () => {
      await Promise.resolve();
      return currentCorrelationId();
    });

    expect(seen).toBe('corr-run');
    expect(currentCorrelationId()).toBeNull();
  });

  it('enterWithCorrelation binds the id to the current async resource', async () => {
    enterWithCorrelation('corr-request');
    await Promise.resolve();
    expect(currentCorrelationId()).toBe('corr-request');
  });

  it('nested scopes restore the outer id on exit', () => {
    const outer = runWithCorrelation('corr-outer', () => {
      const inner = runWithCorrelation('corr-inner', () => currentCorrelationId());
      return { inner, after: currentCorrelationId() };
    });

    expect(outer).toEqual({ inner: 'corr-inner', after: 'corr-outer' });
  });
});
