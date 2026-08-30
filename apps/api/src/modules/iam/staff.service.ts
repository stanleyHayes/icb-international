import type { StaffRole, StaffUser } from '@icb/contracts';
import { Injectable } from '@nestjs/common';

import { ConflictError, ForbiddenError, NotFoundError } from '../../common/errors/index.js';
import { newId } from '../../infrastructure/database/identifier.js';
import { ClockService } from '../../simulation/clock/clock.service.js';
import type { StaffUserDoc } from './infrastructure/iam.schemas.js';
import { StaffStore } from './infrastructure/staff.repository.js';
import { toStaffUser } from './staff.mapper.js';

/** Input for provisioning a staff account. Login material is issued by the auth module. */
export interface CreateStaffInput {
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly roles: readonly StaffRole[];
}

/** Mutable staff fields. */
export interface UpdateStaffInput {
  readonly roles?: readonly StaffRole[] | undefined;
  readonly active?: boolean | undefined;
}

/**
 * Staff lifecycle.
 *
 * Holds no permission logic of its own — what a role may do lives in
 * `common/guards/permissions.constants.ts` (one matrix, one audit surface). This service is
 * about who the operators are: provisioning, role assignment, activation.
 */
@Injectable()
export class StaffService {
  constructor(
    private readonly store: StaffStore,
    private readonly clock: ClockService,
  ) {}

  async listStaff(): Promise<StaffUser[]> {
    const docs = await this.store.listAll();
    return docs.map(toStaffUser);
  }

  async getStaff(staffId: string): Promise<StaffUser> {
    return toStaffUser(await this.requireStaff(staffId));
  }

  async createStaff(input: CreateStaffInput): Promise<StaffUser> {
    const email = input.email.toLowerCase();
    const existing = await this.store.findByEmail(email);
    if (existing) {
      throw new ConflictError('A staff user with this email already exists', { email });
    }
    const doc = this.buildNewStaff({ ...input, email });
    await this.store.insert(doc);
    return toStaffUser(doc);
  }

  /**
   * Applies a role/activation patch.
   *
   * `actorId` is the operator performing the change: an operator may not deactivate their own
   * account, so the system is never left with the person who just locked everyone out being
   * themselves locked out mid-incident.
   */
  async updateStaff(
    staffId: string,
    patch: UpdateStaffInput,
    actorId: string,
  ): Promise<StaffUser> {
    await this.requireStaff(staffId);
    if (patch.active === false && staffId === actorId) {
      throw new ForbiddenError('You cannot deactivate your own staff account', { staffId });
    }
    if (patch.roles !== undefined && patch.roles.length === 0) {
      throw new ConflictError('A staff user must hold at least one role', { staffId });
    }
    const updated = await this.store.applyPatch(staffId, patch);
    if (!updated) {
      throw new NotFoundError('Staff user', staffId);
    }
    return toStaffUser(updated);
  }

  /** Called by the auth module on a successful staff sign-in. */
  async recordLogin(staffId: string): Promise<void> {
    await this.store.recordLogin(staffId, this.clock.now());
  }

  /** Roles held by a staff id — the guard-facing read used when resolving permissions. */
  async rolesOf(staffId: string): Promise<readonly string[]> {
    return (await this.requireStaff(staffId)).roles;
  }

  private async requireStaff(staffId: string): Promise<StaffUserDoc> {
    const doc = await this.store.findById(staffId);
    if (!doc) {
      throw new NotFoundError('Staff user', staffId);
    }
    return doc;
  }

  private buildNewStaff(input: CreateStaffInput): StaffUserDoc {
    const now = this.clock.now();
    return {
      _id: newId(),
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      roles: [...input.roles],
      active: true,
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
    };
  }
}
