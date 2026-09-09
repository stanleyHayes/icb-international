import type { ApprovalRequest, ManualPostingRequest } from '@icb/contracts';
import type { Model } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotFoundError, ValidationError } from '../../../common/errors/index.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import type { AccountDoc } from '../../accounts/infrastructure/account.schemas.js';
import type { ApprovalsService } from '../../iam/approvals.service.js';
import type { PostingCommand } from '../../ledger/domain/posting.types.js';
import type { LedgerService } from '../../ledger/ledger.service.js';
import type { ManualPostingDoc } from '../infrastructure/manual-posting.schemas.js';
import { ManualPostingsService } from '../manual-postings.service.js';

const START = new Date('2026-01-05T09:00:00.000Z');
const MAKER = 'staff-maker';
const ACCOUNT_ID = 'acct-1';
const APPROVAL_ID = 'appr-1';
const TRACKING_ID = 'mp-1';
const TRANSACTION_ID = 'txn-1';
const CONTRA_CODE = '4000';

function makeRequest(overrides: Partial<ManualPostingRequest> = {}): ManualPostingRequest {
  return {
    accountId: ACCOUNT_ID,
    direction: 'credit',
    amount: { minorUnits: 123_456, currency: 'USD', scale: 2 },
    contraAccountCode: CONTRA_CODE,
    description: 'Correction for a misposted fee',
    reason: 'The account maintenance fee was charged to the wrong account',
    ...overrides,
  };
}

function makeApproval(
  status: ApprovalRequest['status'],
  id: string = APPROVAL_ID,
): ApprovalRequest {
  return {
    id,
    kind: 'manual_posting',
    summary: 'Manual credit of USD 1,234.56',
    payload: {},
    amount: { minorUnits: 123_456, currency: 'USD', scale: 2 },
    requestedBy: MAKER,
    requestedAt: START.toISOString(),
    status,
    decidedBy: null,
    decidedAt: null,
    reason: null,
    expiresAt: START.toISOString(),
  };
}

function makeTracking(overrides: Partial<ManualPostingDoc> = {}): ManualPostingDoc {
  return {
    _id: TRACKING_ID,
    approvalId: APPROVAL_ID,
    accountId: ACCOUNT_ID,
    direction: 'credit',
    minorUnits: 123_456,
    currency: 'USD',
    contraAccountCode: CONTRA_CODE,
    description: 'Correction for a misposted fee',
    reason: 'The account maintenance fee was charged to the wrong account',
    valueDate: null,
    status: 'posting',
    transactionId: null,
    attempts: 0,
    failureReason: null,
    requestedBy: MAKER,
    createdAt: START,
    updatedAt: START,
    ...overrides,
  };
}

function makeHarness() {
  const postings = {
    create: vi.fn().mockResolvedValue({}),
    findOneAndUpdate: vi.fn(),
    updateOne: vi.fn().mockResolvedValue({ matchedCount: 1 }),
  };
  const accounts = { findOne: vi.fn() };
  const approvals = {
    requestApproval: vi.fn().mockResolvedValue(makeApproval('pending')),
    listInbox: vi.fn().mockResolvedValue([]),
  };
  const ledger = { post: vi.fn().mockResolvedValue({ id: TRANSACTION_ID }) };
  const clock = new ClockService();
  clock.freeze(START);
  const service = new ManualPostingsService(
    postings as unknown as Model<ManualPostingDoc>,
    accounts as unknown as Model<AccountDoc>,
    approvals as unknown as ApprovalsService,
    ledger as unknown as LedgerService,
    clock,
  );
  return { service, postings, accounts, approvals, ledger };
}

function accountFound(accounts: { findOne: ReturnType<typeof vi.fn> }): void {
  accounts.findOne.mockReturnValue({ lean: () => Promise.resolve({ _id: ACCOUNT_ID }) });
}

describe('ManualPostingsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('requestManualPosting', () => {
    it('creates the tracking document and raises the approval as the staff member', async () => {
      const { service, postings, accounts, approvals } = makeHarness();
      accountFound(accounts);

      const result = await service.requestManualPosting(makeRequest(), MAKER);

      expect(approvals.requestApproval).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'manual_posting',
          requestedBy: MAKER,
          amount: { minorUnits: 123_456, currency: 'USD', scale: 2 },
        }),
      );
      const subjectRef = approvals.requestApproval.mock.calls[0]?.[0].subjectRef as {
        id: string;
      };
      expect(postings.create).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: subjectRef.id,
          approvalId: APPROVAL_ID,
          accountId: ACCOUNT_ID,
          direction: 'credit',
          minorUnits: 123_456,
          currency: 'USD',
          contraAccountCode: CONTRA_CODE,
          status: 'awaiting_approval',
          transactionId: null,
          requestedBy: MAKER,
        }),
      );
      expect(result.id).toBe(APPROVAL_ID);
    });

    it('refuses a contra code the chart of accounts does not hold', async () => {
      // Four digits satisfies the contract, so `1001` used to pass here, clear approval, and
      // only fail in the sweep — where nobody was watching.
      const { service, postings, accounts, approvals } = makeHarness();
      accountFound(accounts);

      await expect(
        service.requestManualPosting(makeRequest({ contraAccountCode: '1001' }), MAKER),
      ).rejects.toBeInstanceOf(ValidationError);
      expect(approvals.requestApproval).not.toHaveBeenCalled();
      expect(postings.create).not.toHaveBeenCalled();
    });

    it('throws NOT_FOUND for an unknown account and raises nothing', async () => {
      const { service, postings, accounts, approvals } = makeHarness();
      accounts.findOne.mockReturnValue({ lean: () => Promise.resolve(null) });

      await expect(service.requestManualPosting(makeRequest(), MAKER)).rejects.toBeInstanceOf(
        NotFoundError,
      );
      expect(approvals.requestApproval).not.toHaveBeenCalled();
      expect(postings.create).not.toHaveBeenCalled();
    });
  });

  describe('executeApproved', () => {
    it('posts a credit as GL-debit / customer-credit and marks the row posted', async () => {
      const { service, postings, approvals, ledger } = makeHarness();
      approvals.listInbox.mockResolvedValue([makeApproval('approved')]);
      postings.findOneAndUpdate.mockResolvedValue(makeTracking({ direction: 'credit' }));

      const posted = await service.executeApproved();

      expect(posted).toBe(1);
      const command = ledger.post.mock.calls[0]?.[0] as PostingCommand;
      expect(command.type).toBe('adjustment');
      expect(command.lines).toHaveLength(2);
      expect(command.lines[0]).toMatchObject({ accountRef: `gl:${CONTRA_CODE}`, direction: 'debit' });
      expect(command.lines[1]).toMatchObject({
        accountRef: `acct:${ACCOUNT_ID}`,
        direction: 'credit',
      });
      expect(command.lines[0]?.amount.minorUnits).toBe(command.lines[1]?.amount.minorUnits);
      expect(command.correlationId).toBe(APPROVAL_ID);
      expect(command.metadata?.['approvalId']).toBe(APPROVAL_ID);
      expect(postings.updateOne).toHaveBeenCalledWith(
        { _id: TRACKING_ID },
        { $set: { status: 'posted', transactionId: TRANSACTION_ID, updatedAt: START } },
      );
    });

    it('posts a debit as customer-debit / GL-credit — the mirror image', async () => {
      const { service, postings, approvals, ledger } = makeHarness();
      approvals.listInbox.mockResolvedValue([makeApproval('approved')]);
      postings.findOneAndUpdate.mockResolvedValue(
        makeTracking({ direction: 'debit', valueDate: '2025-12-31' }),
      );

      await service.executeApproved();

      const command = ledger.post.mock.calls[0]?.[0] as PostingCommand;
      expect(command.lines[0]).toMatchObject({
        accountRef: `acct:${ACCOUNT_ID}`,
        direction: 'debit',
      });
      expect(command.lines[1]).toMatchObject({ accountRef: `gl:${CONTRA_CODE}`, direction: 'credit' });
      expect(command.valueDate).toBe('2025-12-31');
    });

    it('is a no-op when the row is already claimed or posted', async () => {
      const { service, postings, approvals, ledger } = makeHarness();
      approvals.listInbox.mockResolvedValue([makeApproval('approved')]);
      postings.findOneAndUpdate.mockResolvedValue(null);

      const posted = await service.executeApproved();

      expect(posted).toBe(0);
      expect(ledger.post).not.toHaveBeenCalled();
      expect(postings.updateOne).not.toHaveBeenCalled();
    });

    it('releases the claim and records the failure when the ledger rejects', async () => {
      const { service, postings, approvals, ledger } = makeHarness();
      approvals.listInbox.mockResolvedValue([makeApproval('approved')]);
      postings.findOneAndUpdate.mockResolvedValue(makeTracking());
      ledger.post.mockRejectedValue(new Error('balance contention'));

      // The pass absorbs it: a transient failure is this row's problem, not the batch's.
      await expect(service.executeApproved()).resolves.toBe(0);

      expect(postings.updateOne).toHaveBeenCalledWith(
        { _id: TRACKING_ID },
        {
          $set: {
            status: 'awaiting_approval',
            attempts: 1,
            failureReason: 'balance contention',
            updatedAt: START,
          },
        },
      );
    });

    it('keeps going when one row fails, so it cannot block the rest of the queue', async () => {
      // Approved rows are swept newest-first, so an escaping throw stopped every older row
      // behind it — a valid refund could sit unposted because someone mistyped a contra code
      // after it was raised.
      const { service, postings, approvals, ledger } = makeHarness();
      approvals.listInbox.mockResolvedValue([
        makeApproval('approved', 'appr-poison'),
        makeApproval('approved', 'appr-refund'),
      ]);
      postings.findOneAndUpdate
        .mockResolvedValueOnce(makeTracking({ _id: 'mp-poison', approvalId: 'appr-poison' }))
        .mockResolvedValueOnce(makeTracking({ _id: 'mp-refund', approvalId: 'appr-refund' }));
      ledger.post
        .mockRejectedValueOnce(new Error('Unknown general-ledger account code: 1001'))
        .mockResolvedValueOnce({ id: TRANSACTION_ID });

      const posted = await service.executeApproved();

      expect(posted).toBe(1);
      expect(postings.updateOne).toHaveBeenCalledWith(
        { _id: 'mp-refund' },
        { $set: { status: 'posted', transactionId: TRANSACTION_ID, updatedAt: START } },
      );
    });

    it('gives up on a row that has burned its attempts, with the reason attached', async () => {
      const { service, postings, approvals, ledger } = makeHarness();
      approvals.listInbox.mockResolvedValue([makeApproval('approved')]);
      postings.findOneAndUpdate.mockResolvedValue(makeTracking({ attempts: 2 }));
      ledger.post.mockRejectedValue(new Error('Unknown general-ledger account code: 1001'));

      await service.executeApproved();

      // `failed` is outside the claim query, so the sweep never picks it up again.
      expect(postings.updateOne).toHaveBeenCalledWith(
        { _id: TRACKING_ID },
        {
          $set: {
            status: 'failed',
            attempts: 3,
            failureReason: 'Unknown general-ledger account code: 1001',
            updatedAt: START,
          },
        },
      );
    });
  });
});
