import createOpenApiFetchClient from 'openapi-fetch';

import { DEFAULT_BASE_URL } from '../constants.js';
import { stripTrailingSlashes } from '../query.js';
import type { paths } from './openapi.types.js';

type OpenApiClient = ReturnType<typeof createOpenApiFetchClient<paths>>;

export interface GeneratedClientOptions {
  /** API origin, e.g. `https://api.icb.example`. Defaults to local API. */
  baseUrl?: string;
  /** Inject a fetch implementation (tests, server actions, workers). */
  fetchFn?: typeof fetch;
  /** Attach the short-lived access token before every request. */
  getAccessToken?: () => string | null | undefined | Promise<string | null | undefined>;
}

export function createGeneratedClient(options: GeneratedClientOptions = {}): OpenApiClient {
  const client = createOpenApiFetchClient<paths>({
    baseUrl: `${stripTrailingSlashes(options.baseUrl ?? DEFAULT_BASE_URL)}/v1`,
    fetch: options.fetchFn ?? globalThis.fetch.bind(globalThis),
  });
  if (options.getAccessToken === undefined) {
    return client;
  }
  client.use({
    async onRequest({ request }) {
      const token = await options.getAccessToken?.();
      if (token !== undefined && token !== null && token.length > 0) {
        request.headers.set('authorization', `Bearer ${token}`);
      }
      return request;
    },
  });
  return client;
}

export type GeneratedClient = ReturnType<typeof createGeneratedClient>;
