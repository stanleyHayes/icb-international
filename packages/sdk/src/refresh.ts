import { authTokensSchema, type AuthTokens } from '@icb/contracts';

import {
  API_VERSION_PREFIX,
  HEADER_ACCEPT,
  MIME_JSON,
  REFRESH_PATH,
} from './constants.js';
import { toApiError } from './errors.js';

export interface RefresherDeps {
  baseUrl: string;
  fetchFn: typeof fetch;
  credentials: RequestCredentials;
  onTokensRefreshed: ((tokens: AuthTokens) => void) | undefined;
}

export interface Refresher {
  /** Resolves with the new access token. Concurrent callers share one network request. */
  refresh(): Promise<string>;
}

/**
 * Single-flight token refresh. The refresh token lives in an httpOnly cookie, so the call
 * carries no body and no Authorization header; the browser (or a server action forwarding
 * cookies) supplies the credential.
 */
export function createRefresher(deps: RefresherDeps): Refresher {
  let inFlight: Promise<string> | null = null;

  const refresh = (): Promise<string> => {
    inFlight ??= performRefresh(deps).finally(() => {
      inFlight = null;
    });
    return inFlight;
  };

  return { refresh };
}

async function performRefresh(deps: RefresherDeps): Promise<string> {
  const response = await deps.fetchFn(`${deps.baseUrl}${API_VERSION_PREFIX}${REFRESH_PATH}`, {
    method: 'POST',
    credentials: deps.credentials,
    headers: { [HEADER_ACCEPT]: MIME_JSON },
  });
  if (!response.ok) throw await toApiError(response);
  const tokens = authTokensSchema.parse(await response.json());
  deps.onTokensRefreshed?.(tokens);
  return tokens.accessToken;
}
