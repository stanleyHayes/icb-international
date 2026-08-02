import { describe, expect, it } from 'vitest';

import { DEFAULT_EPOCH_ISO } from '../testing.constants.js';
import { TestClock } from '../core/clock.js';

describe('TestClock', () => {
  it('starts at the fixed package epoch', () => {
    expect(TestClock.fixed().iso()).toBe(DEFAULT_EPOCH_ISO);
  });

  it('parses an explicit instant', () => {
    const clock = TestClock.fromIso('2030-06-15T12:00:00.000Z');
    expect(clock.iso()).toBe('2030-06-15T12:00:00.000Z');
    expect(clock.today()).toBe('2030-06-15');
  });

  it('advances deterministically', () => {
    const clock = TestClock.fixed();
    clock.advanceDays(2);
    expect(clock.today()).toBe('2024-01-04');
    clock.advanceBy(1_000);
    expect(clock.epochMilliseconds()).toBe(Date.parse('2024-01-04T09:30:01.000Z'));
  });

  it('projects future instants without moving', () => {
    const clock = TestClock.fixed();
    expect(clock.isoPlusDays(30)).toBe('2024-02-01T09:30:00.000Z');
    expect(clock.datePlusDays(-365)).toBe('2023-01-02');
    expect(clock.iso()).toBe(DEFAULT_EPOCH_ISO);
  });

  it('forks an independent clock at the same instant', () => {
    const clock = TestClock.fixed();
    const fork = clock.fork();
    fork.advanceDays(10);
    expect(clock.iso()).toBe(DEFAULT_EPOCH_ISO);
    expect(fork.iso()).toBe('2024-01-12T09:30:00.000Z');
  });

  it('exposes epoch seconds for JWT iat claims', () => {
    expect(TestClock.fixed().epochSeconds()).toBe(
      Math.floor(Date.parse(DEFAULT_EPOCH_ISO) / 1_000),
    );
  });
});
