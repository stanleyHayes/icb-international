import { Global, Module } from '@nestjs/common';

import { CONFIG, loadConfiguration, type AppConfiguration } from './configuration.js';

/**
 * Global configuration module.
 *
 * Configuration is a value, not a service with `get(key)` lookups: consumers inject the typed
 * object and the compiler catches a typo that a string key never would.
 */
@Global()
@Module({
  providers: [
    {
      provide: CONFIG,
      useFactory: (): AppConfiguration => loadConfiguration(process.env),
    },
  ],
  exports: [CONFIG],
})
export class ConfigModule {}
