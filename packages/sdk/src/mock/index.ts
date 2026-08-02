/**
 * `@icb/sdk/mock` — a zero-backend ICB API.
 *
 * MSW v2 handlers generated from the same endpoint registry as the typed client, serving
 * faker-backed data that satisfies every contract schema. A frontend can build any screen
 * against this mock and swap in the real API by changing only `baseUrl`.
 *
 * Node (tests, RSC, server actions):
 *   const server = setupServer(...createMockHandlers());
 * Browser (dev):
 *   const worker = setupWorker(...createMockHandlers());
 */

export { createMockHandlers, type MockOptions } from './handlers.js';
export { createMockFaker } from './faker.js';
export { fabricate } from './fabricate.js';
export { DEFAULT_MOCK_SEED } from './constants.js';
