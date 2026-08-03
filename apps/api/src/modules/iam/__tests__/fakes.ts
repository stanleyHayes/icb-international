import { newId } from '../../../infrastructure/database/identifier.js';
import type { ApprovalRequestDoc, StaffUserDoc } from '../infrastructure/iam.schemas.js';
import type { ApprovalDecision, ApprovalFilter } from '../infrastructure/approval.repository.js';
import { ApprovalStore } from '../infrastructure/approval.repository.js';
import { StaffStore, type StaffPatch } from '../infrastructure/staff.repository.js';

/**
 * In-memory implementations of the IAM persistence ports.
 *
 * The services under test never see mongoose: the stores are the port boundary, so these
 * fakes reproduce store semantics (including the atomic decide-only-if-pending) without a
 * Mongo replica set. Methods return resolved promises rather than being `async` to keep the
 * fake synchronous in body while honouring the port's promise-based contract.
 */

export class InMemoryStaffStore extends StaffStore {
  readonly rows = new Map<string, StaffUserDoc>();

  findById(staffId: string): Promise<StaffUserDoc | null> {
    return Promise.resolve(this.rows.get(staffId) ?? null);
  }

  findByEmail(email: string): Promise<StaffUserDoc | null> {
    const found = [...this.rows.values()].find((row) => row.email === email) ?? null;
    return Promise.resolve(found);
  }

  listAll(): Promise<StaffUserDoc[]> {
    const sorted = [...this.rows.values()].sort((a, b) =>
      `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`),
    );
    return Promise.resolve(sorted);
  }

  insert(staff: StaffUserDoc): Promise<void> {
    this.rows.set(staff._id, staff);
    return Promise.resolve();
  }

  applyPatch(staffId: string, patch: StaffPatch): Promise<StaffUserDoc | null> {
    const row = this.rows.get(staffId);
    if (!row) return Promise.resolve(null);
    const updated: StaffUserDoc = {
      ...row,
      ...(patch.roles !== undefined ? { roles: [...patch.roles] } : {}),
      ...(patch.active !== undefined ? { active: patch.active } : {}),
    };
    this.rows.set(staffId, updated);
    return Promise.resolve(updated);
  }

  recordLogin(staffId: string, at: Date): Promise<void> {
    const row = this.rows.get(staffId);
    if (row) this.rows.set(staffId, { ...row, lastLoginAt: at });
    return Promise.resolve();
  }
}

export class InMemoryApprovalStore extends ApprovalStore {
  readonly rows = new Map<string, ApprovalRequestDoc>();

  insert(request: ApprovalRequestDoc): Promise<void> {
    this.rows.set(request._id, request);
    return Promise.resolve();
  }

  findById(approvalId: string): Promise<ApprovalRequestDoc | null> {
    return Promise.resolve(this.rows.get(approvalId) ?? null);
  }

  list(filter: ApprovalFilter): Promise<ApprovalRequestDoc[]> {
    const matched = [...this.rows.values()].filter(
      (row) =>
        (filter.status === undefined || row.status === filter.status) &&
        (filter.kind === undefined || row.kind === filter.kind),
    );
    return Promise.resolve(matched);
  }

  decideIfPending(
    approvalId: string,
    decision: ApprovalDecision,
  ): Promise<ApprovalRequestDoc | null> {
    const row = this.rows.get(approvalId);
    if (!row || row.status !== 'pending') return Promise.resolve(null);
    const updated: ApprovalRequestDoc = { ...row, ...decision };
    this.rows.set(approvalId, updated);
    return Promise.resolve(updated);
  }

  expireOverdue(now: Date): Promise<number> {
    let expired = 0;
    for (const [id, row] of this.rows) {
      if (row.status === 'pending' && row.expiresAt.getTime() < now.getTime()) {
        this.rows.set(id, { ...row, status: 'expired' });
        expired += 1;
      }
    }
    return Promise.resolve(expired);
  }
}

export function staffDoc(overrides: Partial<StaffUserDoc> = {}): StaffUserDoc {
  const now = new Date('2026-01-01T09:00:00.000Z');
  return {
    _id: newId(),
    email: 'maker@icb.example',
    firstName: 'Maya',
    lastName: 'Maker',
    roles: ['operations'],
    active: true,
    mfaRequired: true,
    mfaEnabled: false,
    lastLoginAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
