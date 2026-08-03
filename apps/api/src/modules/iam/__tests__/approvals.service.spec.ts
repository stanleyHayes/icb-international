import { beforeEach, describe, expect, it } from 'vitest';

import { ConflictError, ForbiddenError, NotFoundError } from '../../../common/errors/index.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { ApprovalsService, type RequestApprovalInput } from '../approvals.service.js';
import { APPROVAL_TTL } from '../iam.constants.js';
import { InMemoryApprovalStore } from './fakes.js';

const START = new Date('2026-01-05T09:00:00.000Z');
const MAKER = 'staff-maker';
const CHECKER = 'staff-checker';
const REASON = 'Verified against the source document';

describe('ApprovalsService', () => {
  let store: InMemoryApprovalStore;
  let clock: ClockService;
  let service: ApprovalsService;

  beforeEach(() => {
    store = new InMemoryApprovalStore();
    clock = new ClockService();
    clock.freeze(START);
    service = new ApprovalsService(store, clock);
  });

  function input(overrides: Partial<RequestApprovalInput> = {}): RequestApprovalInput {
    return {
      kind: 'high_value_transfer',
      subjectRef: { type: 'transfer', id: 'transfer-1' },
      summary: 'Transfer of 25,000.00 USD to a new beneficiary',
      payload: { transferId: 'transfer-1' },
      amount: { minorUnits: 2_500_000, currency: 'USD', scale: 2 },
      requestedBy: MAKER,
      ...overrides,
    };
  }

  describe('requestApproval', () => {
    it('creates a pending request with the default expiry from the clock', async () => {
      const request = await service.requestApproval(input());

      expect(request.status).toBe('pending');
      expect(request.requestedBy).toBe(MAKER);
      expect(request.decidedBy).toBeNull();
      expect(request.requestedAt).toBe(START.toISOString());
      expect(request.expiresAt).toBe(
        new Date(START.getTime() + APPROVAL_TTL.defaultMs).toISOString(),
      );
      expect(request.amount).toEqual({ minorUnits: 2_500_000, currency: 'USD', scale: 2 });
    });

    it('carries the subject reference inside the wire payload', async () => {
      const request = await service.requestApproval(input());
      expect(request.payload['subjectRef']).toEqual({ type: 'transfer', id: 'transfer-1' });
    });

    it('caps a requested lifetime at the maximum', async () => {
      const request = await service.requestApproval(input({ ttlMs: 365 * 24 * 3_600_000 }));
      expect(request.expiresAt).toBe(
        new Date(START.getTime() + APPROVAL_TTL.maxMs).toISOString(),
      );
    });

    it('defaults payload and amount when the kind carries none', async () => {
      const base = input();
      const request = await service.requestApproval({
        kind: base.kind,
        subjectRef: base.subjectRef,
        summary: base.summary,
        requestedBy: base.requestedBy,
      });
      expect(request.amount).toBeNull();
      expect(request.payload['subjectRef']).toBeDefined();
    });
  });

  describe('decide', () => {
    it('approves a pending request by a different operator', async () => {
      const request = await service.requestApproval(input());
      clock.advance(3_600_000);

      const decided = await service.approve(request.id, CHECKER, REASON);

      expect(decided.status).toBe('approved');
      expect(decided.decidedBy).toBe(CHECKER);
      expect(decided.reason).toBe(REASON);
      expect(decided.decidedAt).toBe(new Date(START.getTime() + 3_600_000).toISOString());
    });

    it('rejects a pending request with a reason', async () => {
      const request = await service.requestApproval(input());
      const decided = await service.reject(request.id, CHECKER, 'Beneficiary looks fraudulent');
      expect(decided.status).toBe('rejected');
      expect(decided.reason).toBe('Beneficiary looks fraudulent');
    });

    it('blocks self-approval — the maker can never be the checker', async () => {
      const request = await service.requestApproval(input());
      await expect(service.approve(request.id, MAKER, REASON)).rejects.toBeInstanceOf(
        ForbiddenError,
      );
      await expect(service.reject(request.id, MAKER, REASON)).rejects.toBeInstanceOf(
        ForbiddenError,
      );
    });

    it('refuses a decision after expiry and marks the request expired', async () => {
      const request = await service.requestApproval(input());
      clock.advance(APPROVAL_TTL.defaultMs + 1);

      await expect(service.approve(request.id, CHECKER, REASON)).rejects.toBeInstanceOf(
        ConflictError,
      );
      expect((await service.getApproval(request.id)).status).toBe('expired');
    });

    it('refuses a second decision — one request, one outcome', async () => {
      const request = await service.requestApproval(input());
      await service.approve(request.id, CHECKER, REASON);
      await expect(service.reject(request.id, 'staff-third', REASON)).rejects.toBeInstanceOf(
        ConflictError,
      );
    });

    it('throws NOT_FOUND for an unknown approval', async () => {
      await expect(service.approve('no-such-id', CHECKER, REASON)).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });
  });

  describe('listInbox', () => {
    it('sweeps overdue requests so checkers never see dead work as pending', async () => {
      const dead = await service.requestApproval(input({ summary: 'old' }));
      clock.advance(APPROVAL_TTL.defaultMs + 1);
      const live = await service.requestApproval(input({ summary: 'fresh' }));

      const inbox = await service.listInbox();

      expect(inbox.find((row) => row.id === dead.id)?.status).toBe('expired');
      expect(inbox.find((row) => row.id === live.id)?.status).toBe('pending');
    });

    it('orders pending work oldest-first, decided rows most-recent-first', async () => {
      const first = await service.requestApproval(input({ summary: 'first' }));
      clock.advance(60_000);
      const second = await service.requestApproval(input({ summary: 'second' }));
      await service.approve(second.id, CHECKER, REASON);

      const inbox = await service.listInbox();
      expect(inbox.map((row) => row.id)).toEqual([first.id, second.id]);
    });

    it('filters by status and kind', async () => {
      await service.requestApproval(input());
      await service.requestApproval(input({ kind: 'refund' }));

      const refunds = await service.listInbox({ kind: 'refund' });
      expect(refunds).toHaveLength(1);
      expect(refunds[0]?.kind).toBe('refund');

      const decided = await service.listInbox({ status: 'approved' });
      expect(decided).toHaveLength(0);
    });
  });
});
