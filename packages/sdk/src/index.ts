/**
 * `@icb/sdk` — the typed ICB API client.
 *
 * One method per endpoint, typed end-to-end from `@icb/contracts`: request bodies are
 * `z.input` of the contract request schemas and responses are validated against the contract
 * response schemas at runtime, so a drifting backend fails loudly at the boundary.
 *
 * The MSW mock lives in the `@icb/sdk/mock` subpath so it never ships in a production bundle.
 */

export { createIcbClient, type IcbClient, type IcbClientOptions } from './client.js';
export { type AccessTokenProvider } from './transport.js';
export { type RequestOptions } from './http.js';
export {
  IcbApiError,
  IcbError,
  IcbNetworkError,
  IcbProtocolError,
  IcbUsageError,
} from './errors.js';
export { createIdempotencyKey } from './idempotency.js';
export { endpointRegistry, type EndpointRegistry } from './endpoints/index.js';
export { type EndpointDef } from './endpoint.js';
