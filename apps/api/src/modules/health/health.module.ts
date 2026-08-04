import { Module } from '@nestjs/common';

import { LedgerModule } from '../ledger/ledger.module.js';
import { HealthController } from './health.controller.js';
import { LedgerHealthService } from './ledger-health.service.js';

@Module({
  imports: [LedgerModule],
  controllers: [HealthController],
  providers: [LedgerHealthService],
})
export class HealthModule {}
