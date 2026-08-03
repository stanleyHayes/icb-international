import type { ApprovalRequest, MoneyDto } from '@icb/contracts';
import { Injectable } from '@nestjs/common';

import { ConflictError, ForbiddenError, NotFoundError } from '../../common/errors/index.js';
import { newId } from '../../infrastructure/database/identifier.js';
import { ClockService } from '../../simulation/clock/clock.service.js';
import { APPROVAL_TTL } from './iam.constants.js';
import { toApprovalRequest } from './approval.mapper.js';
import type { ApprovalRequestDoc } from './infrastructure/iam.schemas.js';
import { ApprovalStore } from './infrastructure/approval.repository.js';

type ApprovalKind = ApprovalRequest['kind'];

/** What a domain module supplies when it needs a second pair of eyes. */
export interface RequestApprovalInput {
  readonly kind: ApprovalKind;
  /** Pointer to the domain object being approved, e.g. `{ type: 'transfer', id: '…' }`. */
  readonly subjectRef: { type: string; id: string };
  /** One human-readable line for the inbox. */
  readonly summary: string;
  /** Arguments the owning module needs to execute the action once approved. */
  readonly payload?: Record<string, unknown>;
  readonly amount?: MoneyDto;
  /** Staff id of the maker — taken from the caller's token, never from request input. */
  readonly requestedBy: string;
  /** Optional shorter lifetime; capped at `APPROVAL_TTL.maxMs`. */
  readonly ttlMs?: number;
}

export interface ApprovalInboxQuery {
  readonly status?: ApprovalRequest['status'] | undefined;
  readonly kind?: ApprovalKind | undefined;
}

/**
 * Maker-checker.
 *
 * One service backs every privileged action that needs four eyes: high-value transfers,
 * manual postings, limit changes, refunds, write-offs. The flow is always the same —
 * a domain module calls `requestApproval` and parks its own action; a *different* operator
 * decides here; the domain module then executes against the approved request. The two rules
 * that make it a control rather than a queue are enforced below: the maker can never be the
 * checker, and an undecided request dies at its expiry.
 */
@Injectable()
export class ApprovalsService {
  constructor(
    private readonly store: ApprovalStore,
    private readonly clock: ClockService,
  ) {}

  async requestApproval(input: RequestApprovalInput): Promise<ApprovalRequest> {
    const now = this.clock.now();
    const ttlMs = Math.min(input.ttlMs ?? APPROVAL_TTL.defaultMs, APPROVAL_TTL.maxMs);
    const doc: ApprovalRequestDoc = {
      _id: newId(),
      kind: input.kind,
      summary: input.summary,
      subjectRef: input.subjectRef,
      payload: input.payload ?? {},
      amount: input.amount ?? null,
      requestedBy: input.requestedBy,
      requestedAt: now,
      status: 'pending',
      decidedBy: null,
      decidedAt: null,
      reason: null,
      expiresAt: new Date(now.getTime() + ttlMs),
      createdAt: now,
      updatedAt: now,
    };
    await this.store.insert(doc);
    return toApprovalRequest(doc);
  }

  /**
   * The unified inbox. Expired requests are swept first, so a checker never sees a
   * still-pending row its deadline has already passed. Pending requests come first,
   * oldest first — they are the work; decided rows follow, most recent first.
   */
  async listInbox(query: ApprovalInboxQuery = {}): Promise<ApprovalRequest[]> {
    await this.store.expireOverdue(this.clock.now());
    const docs = await this.store.list({ ...query });
    return this.orderInbox(docs).map(toApprovalRequest);
  }

  async getApproval(approvalId: string): Promise<ApprovalRequest> {
    return toApprovalRequest(await this.requireApproval(approvalId));
  }

  async approve(
    approvalId: string,
    decidedBy: string,
    reason: string,
  ): Promise<ApprovalRequest> {
    return this.decide(approvalId, decidedBy, reason, 'approved');
  }

  async reject(
    approvalId: string,
    decidedBy: string,
    reason: string,
  ): Promise<ApprovalRequest> {
    return this.decide(approvalId, decidedBy, reason, 'rejected');
  }

  private async decide(
    approvalId: string,
    decidedBy: string,
    reason: string,
    outcome: 'approved' | 'rejected',
  ): Promise<ApprovalRequest> {
    // Sweep first so an overdue request reads as `expired` rather than pending-but-dead.
    await this.store.expireOverdue(this.clock.now());
    const doc = await this.requireApproval(approvalId);
    this.assertDecidable(doc, decidedBy);
    const decided = await this.store.decideIfPending(approvalId, {
      status: outcome,
      decidedBy,
      decidedAt: this.clock.now(),
      reason,
    });
    if (!decided) {
      throw new ConflictError('This approval request was already decided', { approvalId });
    }
    return toApprovalRequest(decided);
  }

  /** The control itself: pending, unexpired, and never the maker's own request. */
  private assertDecidable(doc: ApprovalRequestDoc, decidedBy: string): void {
    if (doc.requestedBy === decidedBy) {
      throw new ForbiddenError('The requester cannot decide their own approval request', {
        approvalId: doc._id,
        requestedBy: doc.requestedBy,
      });
    }
    if (doc.status !== 'pending') {
      throw new ConflictError(`This approval request is already ${doc.status}`, {
        approvalId: doc._id,
        status: doc.status,
      });
    }
    if (doc.expiresAt.getTime() <= this.clock.epochMs()) {
      throw new ConflictError('This approval request has expired', { approvalId: doc._id });
    }
  }

  private async requireApproval(approvalId: string): Promise<ApprovalRequestDoc> {
    const doc = await this.store.findById(approvalId);
    if (!doc) {
      throw new NotFoundError('Approval request', approvalId);
    }
    return doc;
  }

  private orderInbox(docs: readonly ApprovalRequestDoc[]): ApprovalRequestDoc[] {
    const pending = docs
      .filter((doc) => doc.status === 'pending')
      .sort((a, b) => a.requestedAt.getTime() - b.requestedAt.getTime());
    const decided = docs
      .filter((doc) => doc.status !== 'pending')
      .sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime());
    return [...pending, ...decided];
  }
}
