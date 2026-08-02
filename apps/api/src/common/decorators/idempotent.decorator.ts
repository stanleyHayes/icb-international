import { SetMetadata, type CustomDecorator } from '@nestjs/common';

export const IDEMPOTENT_KEY = 'icb:idempotent';

/**
 * Marks a mutating endpoint as idempotent (invariant N6).
 *
 * The `IdempotencyInterceptor` then requires an `Idempotency-Key` header and replays the stored
 * original response for repeat submissions, so a retried transfer never posts twice.
 */
export const Idempotent = (): CustomDecorator<string> => SetMetadata(IDEMPOTENT_KEY, true);
