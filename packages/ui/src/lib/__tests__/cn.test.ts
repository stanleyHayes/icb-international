import { describe, expect, it } from 'vitest';

import { cn } from '../cn';

describe('cn', () => {
  it('joins class names', () => {
    expect(cn('p-2', 'm-1')).toBe('p-2 m-1');
  });

  it('lets the later conflicting Tailwind utility win', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
    expect(cn('text-sm', 'text-lg', 'm-1')).toBe('text-lg m-1');
  });

  it('drops falsy conditional classes', () => {
    const hidden = false;
    expect(cn('p-2', hidden && 'hidden', undefined, null)).toBe('p-2');
  });

  it('flattens arrays and objects', () => {
    expect(cn(['p-2', 'm-1'], { block: true, hidden: false })).toBe('p-2 m-1 block');
  });
});
