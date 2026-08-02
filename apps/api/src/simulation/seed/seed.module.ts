import { Module } from '@nestjs/common';

import { AccountsModule } from '../../modules/accounts/accounts.module.js';
import { AuthModule } from '../../modules/auth/auth.module.js';
import { LedgerModule } from '../../modules/ledger/ledger.module.js';
import { DatabaseResetService } from './database-reset.service.js';
import { SeedIdentityService } from './seed-identity.service.js';
import { SeedService } from './seed.service.js';

@Module({
  imports: [LedgerModule, AccountsModule, AuthModule],
  providers: [DatabaseResetService, SeedIdentityService, SeedService],
  exports: [SeedService],
})
export class SeedModule {}
