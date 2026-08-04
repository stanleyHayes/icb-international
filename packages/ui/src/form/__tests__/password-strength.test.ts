import { describe, expect, it } from 'vitest';

import {
  PASSWORD_STRENGTH_LABELS,
  PASSWORD_STRENGTH_LEVELS,
  scorePassword,
} from '../password-strength';

describe('scorePassword', () => {
  it('scores an empty password at the bottom', () => {
    expect(scorePassword('').score).toBe(0);
    expect(scorePassword('').label).toBe(PASSWORD_STRENGTH_LABELS['very-weak']);
  });

  it('caps short passwords at 1', () => {
    expect(scorePassword('aB1!').score).toBe(1);
    expect(scorePassword('abc').score).toBeLessThanOrEqual(1);
  });

  it('rewards length and character-class breadth', () => {
    const weak = scorePassword('password');
    const fair = scorePassword('passw0rd!');
    const strong = scorePassword('Tr0ub4dor&3xtralong');
    expect(weak.score).toBeLessThan(fair.score);
    expect(fair.score).toBeLessThan(strong.score);
    expect(strong.score).toBeGreaterThanOrEqual(3);
  });

  it('penalises repeated characters', () => {
    expect(scorePassword('Aaa1!aaaaaaaa').score).toBeLessThan(scorePassword('Axc1!bdaejfka').score);
  });

  it('penalises keyboard walks in either direction', () => {
    expect(scorePassword('Qwerty19375!').score).toBeLessThan(scorePassword('Qzmvpt19375!').score);
    expect(scorePassword('4321Axdq!xyz').score).toBeLessThan(scorePassword('4821Axdq!xyz').score);
  });

  it('never leaves the 0–4 band', () => {
    expect(scorePassword('a').score).toBeGreaterThanOrEqual(0);
    expect(scorePassword('Sup3r$ecureP@ssw0rd2026!').score).toBeLessThanOrEqual(4);
  });

  it('exposes a label for every level', () => {
    for (const level of PASSWORD_STRENGTH_LEVELS) {
      expect(PASSWORD_STRENGTH_LABELS[level]).toBeTruthy();
    }
  });
});
