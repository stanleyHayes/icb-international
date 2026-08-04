import { describe, expect, it } from 'vitest';

import {
  areaPath,
  arcPath,
  donutSegmentPath,
  extent,
  linePath,
  niceTicks,
  polarToCartesian,
  xPosition,
  yPosition,
} from '../lib/scale';

describe('extent', () => {
  it('returns the inclusive min and max', () => {
    expect(extent([4, -2, 9, 0])).toEqual([-2, 9]);
  });

  it('returns [0, 0] for an empty series', () => {
    expect(extent([])).toEqual([0, 0]);
  });
});

describe('niceTicks', () => {
  it('starts at zero and covers the maximum on round steps', () => {
    const ticks = niceTicks(95, 4);
    expect(ticks[0]).toBe(0);
    expect(ticks.at(-1)).toBeGreaterThanOrEqual(95);
    const step = ticks[1]! - ticks[0]!;
    for (let i = 2; i < ticks.length; i += 1) {
      expect(ticks[i]! - ticks[i - 1]!).toBe(step);
    }
  });

  it('uses 1/2/5 steps', () => {
    expect(niceTicks(20, 5)).toEqual([0, 5, 10, 15, 20]);
    expect(niceTicks(8, 5)).toEqual([0, 2, 4, 6, 8]);
  });

  it('degenerates safely for non-positive maxima', () => {
    expect(niceTicks(0, 4)).toEqual([0, 1]);
    expect(niceTicks(-5, 4)).toEqual([0, 1]);
  });
});

describe('positions', () => {
  it('spaces x positions evenly inside the padding', () => {
    expect(xPosition(0, 3, 100, 10)).toBe(10);
    expect(xPosition(1, 3, 100, 10)).toBe(50);
    expect(xPosition(2, 3, 100, 10)).toBe(90);
  });

  it('centres a single point', () => {
    expect(xPosition(0, 1, 100, 10)).toBe(50);
  });

  it('maps y so larger values sit higher (smaller y)', () => {
    const domain = { min: 0, max: 100, height: 200, pad: 10 };
    const low = yPosition(0, domain);
    const high = yPosition(100, domain);
    expect(high).toBeLessThan(low);
    expect(low).toBe(190);
    expect(high).toBe(10);
  });

  it('keeps y inside the plot when the domain is flat', () => {
    expect(yPosition(5, { min: 5, max: 5, height: 200, pad: 10 })).toBe(190);
  });
});

describe('paths', () => {
  it('builds an open polyline', () => {
    expect(linePath([{ x: 0, y: 1 }, { x: 2, y: 3 }])).toBe('M0,1L2,3');
    expect(linePath([])).toBe('');
  });

  it('closes an area path down to the baseline', () => {
    const d = areaPath([{ x: 0, y: 10 }, { x: 50, y: 20 }], 100);
    expect(d).toBe('M0,10L50,20L50,100L0,100Z');
    expect(areaPath([], 100)).toBe('');
  });

  it('places polar angles clockwise from twelve o’clock', () => {
    const origin = { x: 0, y: 0 };
    const top = polarToCartesian(origin, 10, 0);
    expect(top.x).toBeCloseTo(0);
    expect(top.y).toBeCloseTo(-10);
    const right = polarToCartesian(origin, 10, 90);
    expect(right.x).toBeCloseTo(10);
    expect(right.y).toBeCloseTo(0);
  });

  it('draws a semicircle gauge track as a single arc', () => {
    expect(arcPath({ x: 100, y: 100 }, 50, -90, 90)).toBe('M150,100A50,50 0 0 0 50,100');
  });

  it('draws a closed annulus segment for the donut', () => {
    const d = donutSegmentPath({ x: 50, y: 50 }, { outer: 50, inner: 30 }, 0, 90);
    expect(d).toContain('A50,50 0 0 1');
    expect(d).toContain('A30,30 0 0 0');
    expect(d.endsWith('Z')).toBe(true);
  });
});
