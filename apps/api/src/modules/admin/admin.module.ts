import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { DEAD_LETTER_QUEUE } from '../../infrastructure/queue/queue.constants.js';
import { QueueModule } from '../../infrastructure/queue/queue.module.js';
import { ACCRUALS_QUEUE } from '../accruals/accruals.constants.js';
import { AccountsModule } from '../accounts/accounts.module.js';
import { CustomerDoc, CustomerSchema } from '../customers/infrastructure/customer.schemas.js';
import { IamModule } from '../iam/iam.module.js';
import { LedgerModule } from '../ledger/ledger.module.js';
import { AdminController } from './admin.controller.js';
import { CustomerDirectoryController } from './customer-directory.controller.js';
import { CustomerDirectoryService } from './customer-directory.service.js';
import { AdminService } from './admin.service.js';
import { ManualPostingDoc, ManualPostingSchema } from './infrastructure/manual-posting.schemas.js';
import { ADMIN_POSTINGS_QUEUE } from './manual-postings.constants.js';
import { ManualPostingsProcessor } from './manual-postings.processor.js';
import { ManualPostingsService } from './manual-postings.service.js';
import { PostingsController } from './postings.controller.js';
import { SystemHealthController } from './system-health.controller.js';
import { SystemHealthService } from './system-health.service.js';

@Module({
  imports: [
    LedgerModule,
    AccountsModule,
    IamModule,
    QueueModule,
    // The admin-postings worker queue plus the two queues the health endpoint reports on.
    // Registering a queue another module owns just creates another Queue instance over it.
    BullModule.registerQueue(
      { name: ADMIN_POSTINGS_QUEUE },
      { name: DEAD_LETTER_QUEUE },
      { name: ACCRUALS_QUEUE },
    ),
    MongooseModule.forFeature([
      { name: CustomerDoc.name, schema: CustomerSchema },
      { name: ManualPostingDoc.name, schema: ManualPostingSchema },
    ]),
  ],
  controllers: [
    AdminController,
    CustomerDirectoryController,
    SystemHealthController,
    PostingsController,
  ],
  providers: [
    AdminService,
    CustomerDirectoryService,
    SystemHealthService,
    ManualPostingsService,
    ManualPostingsProcessor,
  ],
})
export class AdminModule {}
