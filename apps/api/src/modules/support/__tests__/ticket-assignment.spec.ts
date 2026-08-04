import { describe, expect, it } from 'vitest';

import { pickAssignee } from '../domain/ticket-assignment.js';

describe('pickAssignee', () => {
  it('routes to the agent with the fewest open tickets', () => {
    const chosen = pickAssignee([
      { staffId: 'st-1', openTickets: 5 },
      { staffId: 'st-2', openTickets: 1 },
      { staffId: 'st-3', openTickets: 3 },
    ]);
    expect(chosen).toBe('st-2');
  });

  it('breaks ties deterministically on the staff id', () => {
    const candidates = [
      { staffId: 'st-9', openTickets: 2 },
      { staffId: 'st-1', openTickets: 2 },
      { staffId: 'st-5', openTickets: 2 },
    ];
    expect(pickAssignee(candidates)).toBe('st-1');
    // Order of the input must not matter — the same queue assigns the same way.
    expect(pickAssignee([...candidates].reverse())).toBe('st-1');
  });

  it('ignores nothing — every candidate counts, even at zero load', () => {
    expect(pickAssignee([{ staffId: 'st-1', openTickets: 0 }])).toBe('st-1');
  });

  it('returns null when nobody is available, leaving the ticket unassigned', () => {
    expect(pickAssignee([])).toBeNull();
  });
});
