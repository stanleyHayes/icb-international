import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { ApprovalRequestDoc } from './iam.schemas.js';

/** Inbox filter; absent fields mean "no constraint". */
export interface ApprovalFilter {
  readonly status?: string | undefined;
  readonly kind?: string | undefined;
}

/** The write applied when a checker decides. */
export interface ApprovalDecision {
  readonly status: 'approved' | 'rejected';
  readonly decidedBy: string;
  readonly decidedAt: Date;
  readonly reason: string;
}

/**
 * The port every approval-persistence read/write goes through.
 *
 * Same shape as `StaffStore`: the abstract class is the DI token and the contract, so the
 * maker-checker rules (self-approval, expiry) are unit-tested against an in-memory store
 * without a Mongo replica set.
 */
export abstract class ApprovalStore {
  abstract insert(request: ApprovalRequestDoc): Promise<void>;
  abstract findById(approvalId: string): Promise<ApprovalRequestDoc | null>;
  abstract list(filter: ApprovalFilter): Promise<ApprovalRequestDoc[]>;
  /**
   * Applies a decision only if the request is still pending — the atomic compare-and-swap
   * that stops two checkers approving the same request. Returns the updated document, or
   * null when the request was no longer pending.
   */
  abstract decideIfPending(
    approvalId: string,
    decision: ApprovalDecision,
  ): Promise<ApprovalRequestDoc | null>;
  /** Sweeps pending requests past their expiry. Returns how many were expired. */
  abstract expireOverdue(now: Date): Promise<number>;
}

@Injectable()
export class MongoApprovalStore extends ApprovalStore {
  constructor(
    @InjectModel(ApprovalRequestDoc.name)
    private readonly approvals: Model<ApprovalRequestDoc>,
  ) {
    super();
  }

  async insert(request: ApprovalRequestDoc): Promise<void> {
    await this.approvals.create(request);
  }

  async findById(approvalId: string): Promise<ApprovalRequestDoc | null> {
    return this.approvals.findById(approvalId).lean();
  }

  async list(filter: ApprovalFilter): Promise<ApprovalRequestDoc[]> {
    const query: Record<string, unknown> = {};
    if (filter.status !== undefined) query['status'] = filter.status;
    if (filter.kind !== undefined) query['kind'] = filter.kind;
    return this.approvals.find(query).sort({ requestedAt: -1 }).lean();
  }

  async decideIfPending(
    approvalId: string,
    decision: ApprovalDecision,
  ): Promise<ApprovalRequestDoc | null> {
    return this.approvals
      .findOneAndUpdate(
        { _id: approvalId, status: 'pending' },
        { $set: { ...decision } },
        { new: true },
      )
      .lean();
  }

  async expireOverdue(now: Date): Promise<number> {
    const result = await this.approvals.updateMany(
      { status: 'pending', expiresAt: { $lt: now } },
      { $set: { status: 'expired' } },
    );
    return result.modifiedCount;
  }
}
