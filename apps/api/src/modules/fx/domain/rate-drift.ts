import type { CurrencyCode } from '@icb/money';

import { createRandom } from '../../../simulation/seed/random.js';
import { USD_PER_UNIT, VOLATILITY, roundRate } from './base-rates.js';

/**
 * Deterministic rate movement over simulated time.
 *
 * The requirement is contradictory on its face: a demo needs rates that *move*, and a simulation
 * needs results that *repeat*. Both are satisfied by making the rate a pure function of the
 * clock — `mid(pair, t)` — rather than a value someone mutates on a timer.
 *
 * Two consequences worth stating, because they are the whole point:
 *  - advancing the simulated clock a month and asking for a rate gives the same answer every
 *    time, so a screenshot taken today is still true tomorrow;
 *  - the historical series is not stored, it is *recomputed*, so history stays consistent with
 *    the present even after the operator jumps the clock backwards.
 *
 * The shape is value noise: one seeded sample per hour, smoothly interpolated between samples.
 * Sampling independently per hour would produce a sawtooth; smoothstep gives it the continuity a
 * price chart has.
 */

const DRIFT_INTERVAL_MS = 3_600_000;
const HOURS_PER_DAY = 24;

/** One seeded sample in [-1, 1) for a currency at a given hourly step. */
function sample(seed: string, currency: CurrencyCode, step: number): number {
  return createRandom(`${seed}:${currency}:${step}`)() * 2 - 1;
}

/** Hermite smoothing, so the curve has no corners where two samples meet. */
function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/** The multiplier applied to a currency's anchor at a given instant. Always positive. */
export function driftFactor(seed: string, currency: CurrencyCode, atMs: number): number {
  const position = atMs / DRIFT_INTERVAL_MS;
  const step = Math.floor(position);
  const blend = smoothstep(position - step);
  const value =
    sample(seed, currency, step) * (1 - blend) + sample(seed, currency, step + 1) * blend;

  return 1 + (VOLATILITY[currency] ?? 0) * value;
}

/** US dollars per one unit of `currency` at `atMs`. */
export function usdPerUnitAt(seed: string, currency: CurrencyCode, atMs: number): number {
  return USD_PER_UNIT[currency] * driftFactor(seed, currency, atMs);
}

/**
 * The mid-market rate: how many `quote` units one `base` unit buys at `atMs`.
 *
 * Derived through the dollar leg rather than stored per pair, which is what keeps every cross
 * rate consistent with every other one.
 */
export function midRateAt(
  seed: string,
  base: CurrencyCode,
  quote: CurrencyCode,
  atMs: number,
): number {
  if (base === quote) {
    return 1;
  }
  return roundRate(usdPerUnitAt(seed, base, atMs) / usdPerUnitAt(seed, quote, atMs));
}

/** Movement over the last simulated day, as a percentage. The number the ticker shows. */
export function changePercent24h(
  seed: string,
  base: CurrencyCode,
  quote: CurrencyCode,
  atMs: number,
): number {
  const previous = midRateAt(seed, base, quote, atMs - HOURS_PER_DAY * DRIFT_INTERVAL_MS);
  if (previous === 0) {
    return 0;
  }
  const current = midRateAt(seed, base, quote, atMs);
  return Number((((current - previous) / previous) * 100).toFixed(4));
}

/** Evenly spaced instants ending at `atMs`, oldest first — the x-axis of a rate chart. */
export function historyInstants(atMs: number, points: number, hours: number): number[] {
  const spanMs = hours * DRIFT_INTERVAL_MS;
  const stepMs = points > 1 ? spanMs / (points - 1) : spanMs;
  return Array.from({ length: points }, (_unused, index) =>
    Math.round(atMs - spanMs + stepMs * index),
  );
}
