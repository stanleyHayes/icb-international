import { describe, expect, it } from 'vitest';

import {
  KEYS,
  firstEnabledIndex,
  keyToRovingIntent,
  resolveRovingIndex,
} from '../keyboard';

describe('keyToRovingIntent', () => {
  it('maps Home/End on any axis', () => {
    expect(keyToRovingIntent(KEYS.HOME, 'horizontal')).toBe('first');
    expect(keyToRovingIntent(KEYS.END, 'vertical')).toBe('last');
  });

  it('maps vertical arrows on vertical and both axes', () => {
    expect(keyToRovingIntent(KEYS.ARROW_DOWN, 'vertical')).toBe('next');
    expect(keyToRovingIntent(KEYS.ARROW_UP, 'both')).toBe('previous');
    expect(keyToRovingIntent(KEYS.ARROW_DOWN, 'horizontal')).toBeNull();
  });

  it('maps horizontal arrows on horizontal and both axes', () => {
    expect(keyToRovingIntent(KEYS.ARROW_RIGHT, 'horizontal')).toBe('next');
    expect(keyToRovingIntent(KEYS.ARROW_LEFT, 'both')).toBe('previous');
    expect(keyToRovingIntent(KEYS.ARROW_LEFT, 'vertical')).toBeNull();
  });

  it('returns null for non-navigation keys', () => {
    expect(keyToRovingIntent(KEYS.ENTER, 'both')).toBeNull();
    expect(keyToRovingIntent('a', 'both')).toBeNull();
  });
});

describe('resolveRovingIndex', () => {
  it('moves next/previous with wrap-around by default', () => {
    expect(resolveRovingIndex({ count: 3, current: 2, intent: 'next' })).toBe(0);
    expect(resolveRovingIndex({ count: 3, current: 0, intent: 'previous' })).toBe(2);
  });

  it('clamps at the ends when wrap is disabled', () => {
    expect(resolveRovingIndex({ count: 3, current: 2, intent: 'next', wrap: false })).toBe(2);
    expect(resolveRovingIndex({ count: 3, current: 0, intent: 'previous', wrap: false })).toBe(0);
  });

  it('jumps to first and last', () => {
    expect(resolveRovingIndex({ count: 5, current: 2, intent: 'first' })).toBe(0);
    expect(resolveRovingIndex({ count: 5, current: 2, intent: 'last' })).toBe(4);
  });

  it('skips disabled slots in the direction of travel', () => {
    const isEnabled = (index: number) => index !== 1;
    expect(resolveRovingIndex({ count: 4, current: 0, intent: 'next', isEnabled })).toBe(2);
    expect(resolveRovingIndex({ count: 4, current: 2, intent: 'previous', isEnabled })).toBe(0);
  });

  it('stays put when every other slot is disabled', () => {
    const isEnabled = (index: number) => index === 1;
    expect(resolveRovingIndex({ count: 3, current: 1, intent: 'next', isEnabled })).toBe(1);
  });

  it('handles an empty list', () => {
    expect(resolveRovingIndex({ count: 0, current: 0, intent: 'next' })).toBe(0);
  });
});

describe('firstEnabledIndex', () => {
  it('returns the first enabled slot', () => {
    expect(firstEnabledIndex(3, (i) => i > 0)).toBe(1);
    expect(firstEnabledIndex(3, () => true)).toBe(0);
  });

  it('falls back to 0 when nothing is enabled or the list is empty', () => {
    expect(firstEnabledIndex(3, () => false)).toBe(0);
    expect(firstEnabledIndex(0, () => true)).toBe(0);
  });
});
