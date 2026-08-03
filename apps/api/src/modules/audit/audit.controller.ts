import { auditQuerySchema, type AuditEvent, type OffsetPage } from '@icb/contracts';
import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';

import { Permissions } from '../../common/decorators/permissions.decorator.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { NDJSON_CONTENT_TYPE } from './audit.constants.js';
import { AuditService } from './audit.service.js';
import type { AuditIntegrity, AuditQuery } from './domain/audit-event.js';

/**
 * The audit console API (`/v1/admin/audit/*`).
 *
 * Read-only by construction — the collection itself refuses mutation at the schema level, so
 * these routes are the entire surface. Everything is gated on the `audit:read` permission:
 * the trail names actors and actions, and who-did-what is itself sensitive.
 */
@Controller('admin/audit')
@UseGuards(PermissionsGuard)
@Permissions('audit:read')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get('events')
  async search(
    @Query(new ZodValidationPipe(auditQuerySchema)) query: AuditQuery,
  ): Promise<OffsetPage<AuditEvent>> {
    return this.audit.search(query);
  }

  /** Re-walks the chain and reports the first broken link, if any. */
  @Get('integrity')
  async integrity(): Promise<AuditIntegrity> {
    return this.audit.verifyIntegrity();
  }

  /** NDJSON stream of a search result, one event per line, in chain order. */
  @Get('export')
  @Header('content-type', NDJSON_CONTENT_TYPE)
  async exportEvents(
    @Query(new ZodValidationPipe(auditQuerySchema)) query: AuditQuery,
  ): Promise<string> {
    return this.audit.exportEvents(query);
  }
}
