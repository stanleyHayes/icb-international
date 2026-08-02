import { Global, Inject, Module, type OnModuleDestroy } from '@nestjs/common';
import type { Redis } from 'ioredis';

import { CONFIG, type AppConfiguration } from '../../config/configuration.js';
import { CacheService } from './cache.service.js';
import { createRedisClient, REDIS_CLIENT } from './redis.client.js';

/**
 * Redis-backed cache.
 *
 * When no `REDIS_URL` is configured the module still boots and CacheService becomes a no-op:
 * caching is an optimisation, not a dependency, and an environment without Redis must degrade
 * to straight-to-database reads rather than refuse to start.
 */
@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [CONFIG],
      useFactory: (config: AppConfiguration): Redis | null =>
        config.redis.url.length > 0 ? createRedisClient(config.redis.url) : null,
    },
    CacheService,
  ],
  exports: [CacheService, REDIS_CLIENT],
})
export class CacheModule implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis | null) {}

  async onModuleDestroy(): Promise<void> {
    await this.client?.quit();
  }
}
