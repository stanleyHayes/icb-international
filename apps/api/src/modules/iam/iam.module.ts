import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AuthModule } from '../auth/auth.module.js';
import { ApprovalsController } from './approvals.controller.js';
import { ApprovalsService } from './approvals.service.js';
import {
  ApprovalRequestDoc,
  ApprovalRequestSchema,
  StaffUserDoc,
  StaffUserSchema,
} from './infrastructure/iam.schemas.js';
import { ApprovalStore, MongoApprovalStore } from './infrastructure/approval.repository.js';
import { MongoStaffStore, StaffStore } from './infrastructure/staff.repository.js';
import { PermissionMatrixService } from './permission-matrix.service.js';
import { StaffController } from './staff.controller.js';
import { StaffSessionPolicy } from './staff-session.policy.js';
import { StaffService } from './staff.service.js';

/**
 * Identity & access for the back office.
 *
 * Owns staff lifecycle, the permission matrix exposed as data, the maker-checker engine and
 * staff session policy. Depends on AuthModule for the step-up tokens that guard privileged
 * mutations; the ClockService is global. Other modules integrate by injecting
 * `ApprovalsService.requestApproval` (transfers, ledger, limits, refunds) and by enforcing
 * `StaffSessionPolicy` in the auth flow.
 */
@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: StaffUserDoc.name, schema: StaffUserSchema },
      { name: ApprovalRequestDoc.name, schema: ApprovalRequestSchema },
    ]),
  ],
  controllers: [StaffController, ApprovalsController],
  providers: [
    { provide: StaffStore, useClass: MongoStaffStore },
    { provide: ApprovalStore, useClass: MongoApprovalStore },
    StaffService,
    ApprovalsService,
    StaffSessionPolicy,
    PermissionMatrixService,
  ],
  exports: [StaffService, ApprovalsService, StaffSessionPolicy, PermissionMatrixService],
})
export class IamModule {}
