import { describe, expect, it } from 'vitest';

import { filterOptions, firstEnabledOptionIndex, stepEnabledIndex, type ComboOption } from '../combo-utils';

const OPTIONS: ComboOption[] = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta', disabled: true },
  { value: 'c', label: 'Gamma' },
  { value: 'd', label: 'Delta' },
];

describe('filterOptions', () => {
  it('matches case-insensitively on the label', () => {
    expect(filterOptions(OPTIONS, 'alpha')).toEqual([OPTIONS[0]]);
    expect(filterOptions(OPTIONS, 'TA').map((option) => option.value)).toEqual(['b', 'd']);
  });

  it('keeps everything for a blank query', () => {
    expect(filterOptions(OPTIONS, '')).toHaveLength(4);
    expect(filterOptions(OPTIONS, '   ')).toHaveLength(4);
  });
});

describe('firstEnabledOptionIndex', () => {
  it('skips disabled options', () => {
    expect(firstEnabledOptionIndex(OPTIONS)).toBe(0);
    expect(firstEnabledOptionIndex([OPTIONS[1] as ComboOption, OPTIONS[2] as ComboOption])).toBe(1);
  });

  it('returns -1 when nothing is enabled', () => {
    expect(firstEnabledOptionIndex([])).toBe(-1);
    expect(firstEnabledOptionIndex([{ value: 'x', label: 'X', disabled: true }])).toBe(-1);
  });
});

describe('stepEnabledIndex', () => {
  it('steps past disabled options', () => {
    expect(stepEnabledIndex(OPTIONS, 0, 1)).toBe(2);
  });

  it('wraps at both ends', () => {
    expect(stepEnabledIndex(OPTIONS, 3, 1)).toBe(0);
    expect(stepEnabledIndex(OPTIONS, 0, -1)).toBe(3);
  });

  it('returns -1 when every option is disabled', () => {
    expect(stepEnabledIndex([{ value: 'x', label: 'X', disabled: true }], 0, 1)).toBe(-1);
    expect(stepEnabledIndex([], -1, 1)).toBe(-1);
  });
});
