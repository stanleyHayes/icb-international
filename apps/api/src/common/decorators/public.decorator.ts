import { SetMetadata, type CustomDecorator } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'icb:isPublic';

/**
 * Opts a route out of authentication.
 *
 * Authentication is global, so this decorator is the *only* way an endpoint becomes reachable
 * without a token — which makes every public surface greppable in one command.
 */
export const Public = (): CustomDecorator<string> => SetMetadata(IS_PUBLIC_KEY, true);
