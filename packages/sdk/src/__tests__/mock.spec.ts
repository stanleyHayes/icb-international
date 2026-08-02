import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { type CallArgs, type EndpointDef } from '../endpoint.js';
import { endpointRegistry } from '../endpoints/index.js';
import { fabricate } from '../mock/fabricate.js';
import { createMockFaker } from '../mock/faker.js';
import { createMockHandlers } from '../mock/handlers.js';
import { createRefresher } from '../refresh.js';
import { createRequester } from '../transport.js';

const BASE_URL = 'http://mock.icb.test';
const PARAM_VALUES: Readonly<Record<string, string>> = {
  rail: 'ach',
  productCode: 'EVERYDAY-CURRENT',
  flagKey: 'beta-dashboard',
};
const DEFAULT_PARAM_VALUE = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const PATH_PARAM_PATTERN = /:([A-Za-z]+)/g;

const server = setupServer(...createMockHandlers({ baseUrl: BASE_URL }));

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

function buildRequester() {
  const fetchFn = globalThis.fetch.bind(globalThis);
  return createRequester({
    baseUrl: BASE_URL,
    fetchFn,
    credentials: 'include',
    getAccessToken: () => 'smoke-test-token',
    refresher: createRefresher({
      baseUrl: BASE_URL,
      fetchFn,
      credentials: 'include',
      onTokensRefreshed: undefined,
    }),
  });
}

function paramsFor(path: string): Record<string, string> | undefined {
  const names = [...path.matchAll(PATH_PARAM_PATTERN)].map((match) => match[1] ?? '');
  if (names.length === 0) return undefined;
  return Object.fromEntries(names.map((name) => [name, PARAM_VALUES[name] ?? DEFAULT_PARAM_VALUE]));
}

describe('@icb/sdk/mock smoke', () => {
  it('serves a schema-valid response for every endpoint in the registry', async () => {
    const call = buildRequester();
    const faker = createMockFaker(1234);
    const labels: string[] = [];
    for (const [namespace, endpoints] of Object.entries(endpointRegistry)) {
      for (const [name, def] of Object.entries(endpoints)) {
        const genericDef: EndpointDef = def;
        const args: CallArgs<EndpointDef> = {
          params: paramsFor(def.path),
          body: def.body === undefined ? undefined : (fabricate(def.body, faker) as never),
        };
        // The client parses every response against the endpoint's contract schema, so a
        // successful resolve here *is* the schema-satisfaction assertion for the mock.
        await expect(
          call(genericDef, args),
          `${namespace}.${name} (${def.method} ${def.path})`,
        ).resolves.not.toThrow();
        labels.push(`${namespace}.${name}`);
      }
    }
    expect(labels.length).toBeGreaterThan(100);
  });
});
