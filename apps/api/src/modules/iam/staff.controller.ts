import {
  createStaffUserRequestSchema,
  type StaffUser,
} from '@icb/contracts';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { AuditAction } from '../../common/decorators/audit-action.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Permissions } from '../../common/decorators/permissions.decorator.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { ZodValidationPipe, zodBody } from '../../common/pipes/zod-validation.pipe.js';
import type { AccessTokenClaims } from '../auth/application/token.service.js';
import { updateStaffUserRequestSchema, type UpdateStaffUserRequest } from './iam.requests.js';
import { StaffService } from './staff.service.js';

/**
 * Staff directory administration.
 *
 * Gated by capability (`staff:manage`) rather than by role name, so the answer to "who may
 * add an operator?" lives in the permission matrix, not in this decorator.
 */
@Controller('admin/staff')
@UseGuards(PermissionsGuard)
@Permissions('staff:manage')
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  @Get()
  async listStaff(): Promise<StaffUser[]> {
    return this.staff.listStaff();
  }

  @Get(':staffId')
  async getStaff(@Param('staffId') staffId: string): Promise<StaffUser> {
    return this.staff.getStaff(staffId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @AuditAction('staff.create')
  async createStaff(
    @Body(zodBody(createStaffUserRequestSchema))
    body: ReturnType<typeof createStaffUserRequestSchema.parse>,
  ): Promise<StaffUser> {
    return this.staff.createStaff(body);
  }

  @Patch(':staffId')
  @AuditAction('staff.update')
  async updateStaff(
    @CurrentUser() actor: AccessTokenClaims,
    @Param('staffId') staffId: string,
    @Body(new ZodValidationPipe(updateStaffUserRequestSchema))
    body: UpdateStaffUserRequest,
  ): Promise<StaffUser> {
    return this.staff.updateStaff(staffId, body, actor.sub);
  }
}
