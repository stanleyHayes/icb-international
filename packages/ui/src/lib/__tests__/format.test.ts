import { describe, expect, it } from 'vitest';

import {
  formatDate,
  formatMoney,
  formatRelativeDay,
  formatTime,
  groupIdentifier,
  initialsOf,
  maskIdentifier,
} from '../format';

describe('formatMoney', () => {
  it('formats minor units with the currency symbol', () => {
    expect(formatMoney({ minorUnits: 123456, currency: 'USD' })).toBe('$1,234.56');
  });

  it('supports the code display and an explicit sign', () => {
    expect(formatMoney({ minorUnits: 123456, currency: 'USD' }, { display: 'code' })).toBe(
      'USD 1,234.56',
    );
    expect(formatMoney({ minorUnits: 500, currency: 'USD' }, { signed: true })).toBe('+$5.00');
  });
});

describe('formatDate', () => {
  const day = new Date(2026, 0, 5);

  it('formats the medium style by default', () => {
    expect(formatDate(day)).toBe('5 Jan 2026');
  });

  it('accepts ISO strings and the short style', () => {
    expect(formatDate('2026-01-05T12:00:00', 'short')).toBe('5 Jan');
  });
});

describe('formatTime', () => {
  it('formats hours and minutes', () => {
    expect(formatTime(new Date(2026, 0, 5, 14, 30))).toBe('14:30');
  });
});

describe('formatRelativeDay', () => {
  const now = new Date(2026, 5, 10, 15, 0);

  it('labels today and yesterday', () => {
    expect(formatRelativeDay(new Date(2026, 5, 10, 9, 0), now)).toBe('Today');
    expect(formatRelativeDay(new Date(2026, 5, 9, 23, 0), now)).toBe('Yesterday');
  });

  it('uses the weekday inside a week, then the date', () => {
    expect(formatRelativeDay(new Date(2026, 5, 8, 12, 0), now)).toBe('Monday');
    expect(formatRelativeDay(new Date(2026, 4, 1, 12, 0), now)).toBe('1 May 2026');
  });
});

describe('groupIdentifier', () => {
  it('groups into fours and strips existing spaces', () => {
    expect(groupIdentifier('1234 56789')).toBe('1234 5678 9');
  });
});

describe('maskIdentifier', () => {
  it('masks all but the last four characters', () => {
    expect(maskIdentifier('123456789')).toBe('•••• 6789');
  });

  it('returns short identifiers unchanged', () => {
    expect(maskIdentifier('6789')).toBe('6789');
  });
});

describe('initialsOf', () => {
  it('combines first and last name initials', () => {
    expect(initialsOf('ada', 'lovelace')).toBe('AL');
  });

  it('falls back to the email local part, then a default', () => {
    expect(initialsOf('', '', 'ops@icb.example')).toBe('OP');
    expect(initialsOf('', '')).toBe('IC');
  });
});
