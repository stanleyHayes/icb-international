import { Global, Module } from '@nestjs/common';

import { ClockService } from './clock.service.js';

/**
 * Time is a cross-cutting concern, so ClockService is global: every module injects the same
 * instance and therefore sees the same "now" after a simulated jump.
 */
@Global()
@Module({
  providers: [ClockService],
  exports: [ClockService],
})
export class ClockModule {}
