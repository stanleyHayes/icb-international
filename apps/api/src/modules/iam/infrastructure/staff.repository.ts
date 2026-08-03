import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { StaffUserDoc } from './iam.schemas.js';

/** Fields a staff update may touch. Email and identity are immutable after creation. */
export interface StaffPatch {
  readonly roles?: readonly string[] | undefined;
  readonly active?: boolean | undefined;
}

/**
 * The port every staff-persistence read/write goes through.
 *
 * Declared as an abstract class so it is both the DI token and the contract: services depend
 * on `StaffStore`, tests substitute an in-memory implementation, and Mongo stays behind this
 * boundary (the replica set is not required to unit-test IAM policy).
 */
export abstract class StaffStore {
  abstract findById(staffId: string): Promise<StaffUserDoc | null>;
  abstract findByEmail(email: string): Promise<StaffUserDoc | null>;
  abstract listAll(): Promise<StaffUserDoc[]>;
  abstract insert(staff: StaffUserDoc): Promise<void>;
  abstract applyPatch(staffId: string, patch: StaffPatch): Promise<StaffUserDoc | null>;
  abstract recordLogin(staffId: string, at: Date): Promise<void>;
}

@Injectable()
export class MongoStaffStore extends StaffStore {
  constructor(@InjectModel(StaffUserDoc.name) private readonly staff: Model<StaffUserDoc>) {
    super();
  }

  async findById(staffId: string): Promise<StaffUserDoc | null> {
    return this.staff.findById(staffId).lean();
  }

  async findByEmail(email: string): Promise<StaffUserDoc | null> {
    return this.staff.findOne({ email }).lean();
  }

  async listAll(): Promise<StaffUserDoc[]> {
    return this.staff.find({}).sort({ lastName: 1, firstName: 1 }).lean();
  }

  async insert(staff: StaffUserDoc): Promise<void> {
    await this.staff.create(staff);
  }

  async applyPatch(staffId: string, patch: StaffPatch): Promise<StaffUserDoc | null> {
    return this.staff
      .findByIdAndUpdate(staffId, { $set: { ...patch } }, { new: true })
      .lean();
  }

  async recordLogin(staffId: string, at: Date): Promise<void> {
    await this.staff.updateOne({ _id: staffId }, { $set: { lastLoginAt: at } });
  }
}
