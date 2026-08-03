import type { Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import type { AccountDoc } from '../../../accounts/infrastructure/account.schemas.js';
import { customerRef } from '../../../ledger/domain/account-ref.js';
import type { AccountBalanceDoc } from '../../../ledger/infrastructure/ledger.schemas.js';
import { AdminViewAssembler } from '../admin-view.assembler.js';
import type { CustomerNoteDoc } from '../customer-note.schemas.js';
import { chainQuery, customerDoc } from '../../__tests__/fixtures.js';

function setup(balances: { ledgerMinorUnits: number }[], noteCount: number) {
  const accounts = {
    find: vi.fn().mockReturnValue(chainQuery([{ _id: 'acct-1' }, { _id: 'acct-2' }])),
  };
  const balanceModel = { find: vi.fn().mockReturnValue(chainQuery(balances)) };
  const notes = { countDocuments: vi.fn().mockResolvedValue(noteCount) };

  const assembler = new AdminViewAssembler(
    accounts as unknown as Model<AccountDoc>,
    balanceModel as unknown as Model<AccountBalanceDoc>,
    notes as unknown as Model<CustomerNoteDoc>,
  );
  return { accounts, balanceModel, notes, assembler };
}

describe('assemble', () => {
  it('sums base-currency balances, counts open accounts and notes', async () => {
    const { assembler } = setup([{ ledgerMinorUnits: 10_000 }, { ledgerMinorUnits: 2_500 }], 3);

    const view = await assembler.assemble(customerDoc());

    expect(view.id).toBe('01J8ZCQ0R0K3M4N5P6Q7R8S9T0');
    expect(view.accountCount).toBe(2);
    expect(view.internalNotes).toBe(3);
    expect(view.totalRelationshipValue).toEqual({ minorUnits: 12_500, currency: 'USD', scale: 2 });
    expect(view.riskRating).toBe('low');
    expect(view.memberSince).toBe('2026-08-02T12:00:00.000Z');
  });

  it('scopes the balance read to the customer’s own accounts in the base currency', async () => {
    const { balanceModel, assembler } = setup([], 0);

    await assembler.assemble(customerDoc());

    expect(balanceModel.find).toHaveBeenCalledWith({
      accountRef: { $in: [customerRef('acct-1'), customerRef('acct-2')] },
      currency: 'USD',
    });
  });

  it('reports a zero relationship value when there are no balances', async () => {
    const { assembler } = setup([], 0);

    const view = await assembler.assemble(customerDoc());

    expect(view.totalRelationshipValue.minorUnits).toBe(0);
  });
});
