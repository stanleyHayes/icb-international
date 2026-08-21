import { Global, Module } from '@nestjs/common';

import { CacheService } from './cache.service.js';

/**
 * In-process cache.
 *
 * Previously Redis-backed. The cache is an optimisation rather than a dependency — every caller
 * can recompute — so dropping the external store costs a shared cache across instances and
 * nothing else. See CacheService for the scope this now has.
 */
@Global()
@Module({
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule {}
