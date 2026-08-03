import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';

import { AuditInterceptor } from './application/audit.interceptor.js';
import { AuditController } from './audit.controller.js';
import { AuditService } from './audit.service.js';
import { AuditEventRepository } from './infrastructure/audit-event.repository.js';
import { AuditEventDoc, AuditEventSchema } from './infrastructure/audit-event.schemas.js';

/**
 * The append-only, hash-chained audit trail (agent_plan.md N7).
 *
 * `AuditService` is exported deliberately: it is the port every other module uses to record
 * privileged actions (auth events, money movement, admin operations), and the interceptor bound
 * here is what gives `@AuditAction` its teeth.
 */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: AuditEventDoc.name, schema: AuditEventSchema }]),
  ],
  controllers: [AuditController],
  providers: [
    AuditEventRepository,
    AuditService,
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
  exports: [AuditService],
})
export class AuditModule {}
