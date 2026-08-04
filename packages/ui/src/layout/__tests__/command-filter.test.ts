import { describe, expect, it } from 'vitest';

import { filterCommands, groupCommands } from '../command-filter';

const commands = [
  { id: 'transfer', label: 'Make a transfer', group: 'Payments', keywords: ['send', 'pay'] },
  { id: 'accounts', label: 'View accounts', group: 'Navigate' },
  { id: 'statements', label: 'Download statements', group: 'Documents', keywords: ['pdf'] },
  { id: 'support', label: 'Contact support', group: 'Navigate' },
] as const;

describe('filterCommands', () => {
  it('returns everything in order for a blank query', () => {
    expect(filterCommands(commands, '  ').map((c) => c.id)).toEqual([
      'transfer',
      'accounts',
      'statements',
      'support',
    ]);
  });

  it('matches case-insensitively and trims the query', () => {
    expect(filterCommands(commands, ' TRANSFER ').map((c) => c.id)).toEqual(['transfer']);
  });

  it('ranks label prefix above label substring above keyword matches', () => {
    const ranked = filterCommands(
      [
        { id: 'kw', label: 'Compose', keywords: ['send money'] },
        { id: 'sub', label: 'Resend statement' },
        { id: 'pre', label: 'Send a wire' },
      ],
      'sen',
    );
    expect(ranked.map((c) => c.id)).toEqual(['pre', 'sub', 'kw']);
  });

  it('keeps original order on ties', () => {
    const ranked = filterCommands(commands, 'a');
    expect(ranked[0]?.id).toBe('transfer');
    expect(ranked[1]?.id).toBe('accounts');
  });

  it('returns an empty list when nothing matches', () => {
    expect(filterCommands(commands, 'zzz')).toEqual([]);
  });
});

describe('groupCommands', () => {
  it('groups by label preserving first-seen order', () => {
    const groups = groupCommands(commands);
    expect(groups.map((g) => g.group)).toEqual(['Payments', 'Navigate', 'Documents']);
    expect(groups[1]?.items.map((c) => c.id)).toEqual(['accounts', 'support']);
  });

  it('collects ungrouped commands under an undefined group', () => {
    const groups = groupCommands([{ id: 'a', label: 'A' }, { id: 'b', label: 'B', group: 'G' }]);
    expect(groups[0]?.group).toBeUndefined();
    expect(groups[0]?.items[0]?.id).toBe('a');
  });
});
