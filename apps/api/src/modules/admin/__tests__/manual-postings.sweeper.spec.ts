import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppConfiguration } from '../../../config/configuration.js';
import type { ManualPostingsService } from '../manual-postings.service.js';
import { ManualPostingsSweeper } from '../manual-postings.sweeper.js';

function makeHarness(options: { backgroundJobs?: boolean } = {}) {
  const executeApproved = vi.fn<() => Promise<number>>().mockResolvedValue(2);
  const config = {
    backgroundJobs: { enabled: options.backgroundJobs ?? true },
  } as unknown as AppConfiguration;
  const sweeper = new ManualPostingsSweeper(config, {
    executeApproved,
  } as unknown as ManualPostingsService);
  return { sweeper, executeApproved };
}

describe('ManualPostingsSweeper', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('posts everything newly approved on a sweep', async () => {
    const { sweeper, executeApproved } = makeHarness();

    await expect(sweeper.sweepOnce()).resolves.toBe(2);
    expect(executeApproved).toHaveBeenCalledTimes(1);
  });

  it('survives a failed sweep so the next interval retries', async () => {
    const { sweeper, executeApproved } = makeHarness();
    executeApproved.mockRejectedValueOnce(new Error('mongo unavailable'));

    await expect(sweeper.sweepOnce()).resolves.toBeNull();
    await expect(sweeper.sweepOnce()).resolves.toBe(2);
  });

  it('skips an overlapping sweep rather than posting the same batch twice', async () => {
    const { sweeper, executeApproved } = makeHarness();
    let release!: (value: number) => void;
    const pending = new Promise<number>((resolve) => {
      release = resolve;
    });
    executeApproved.mockReturnValueOnce(pending);

    const first = sweeper.sweepOnce();
    await expect(sweeper.sweepOnce()).resolves.toBeNull();

    release(1);
    await expect(first).resolves.toBe(1);
    expect(executeApproved).toHaveBeenCalledTimes(1);
  });

  it('schedules nothing when background jobs are disabled', () => {
    vi.useFakeTimers();
    const { sweeper, executeApproved } = makeHarness({ backgroundJobs: false });

    sweeper.onApplicationBootstrap();
    vi.advanceTimersByTime(60_000);

    expect(executeApproved).not.toHaveBeenCalled();
    sweeper.onModuleDestroy();
  });

  it('sweeps on the interval once bootstrapped, and stops on destroy', () => {
    vi.useFakeTimers();
    const { sweeper, executeApproved } = makeHarness();

    sweeper.onApplicationBootstrap();
    vi.advanceTimersByTime(15_000);
    expect(executeApproved).toHaveBeenCalledTimes(1);

    sweeper.onModuleDestroy();
    vi.advanceTimersByTime(60_000);
    expect(executeApproved).toHaveBeenCalledTimes(1);
  });
});
