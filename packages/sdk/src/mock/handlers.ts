import { type Faker } from '@faker-js/faker';
import { http, HttpResponse, type JsonBodyType, type RequestHandler } from 'msw';

import { API_VERSION_PREFIX, DEFAULT_BASE_URL, HTTP_STATUS_NO_CONTENT } from '../constants.js';
import { type EndpointDef } from '../endpoint.js';
import { endpointRegistry } from '../endpoints/index.js';
import { type HttpMethod } from '../http.js';
import { fabricate } from './fabricate.js';
import { createMockFaker } from './faker.js';

export interface MockOptions {
  /** API origin the handlers intercept; must match the client's `baseUrl`. */
  baseUrl?: string;
  /** Deterministic data: the same seed produces the same customers and balances. */
  seed?: number;
}

type HttpFactory = (path: string, resolver: () => Response) => RequestHandler;

const HTTP_FACTORIES: Readonly<Record<HttpMethod, HttpFactory>> = {
  GET: http.get,
  POST: http.post,
  PATCH: http.patch,
  PUT: http.put,
  DELETE: http.delete,
};

const TRAILING_SLASHES = /\/+$/;
const PATH_PARAM_PATTERN = /:[A-Za-z]+/g;

/**
 * MSW v2 handlers covering the entire API surface, generated from the same endpoint registry
 * the typed client consumes. Pair with `setupServer` (Node, RSC, tests) or `setupWorker`
 * (browser) — the handlers themselves are environment-agnostic.
 */
export function createMockHandlers(options: MockOptions = {}): RequestHandler[] {
  const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(TRAILING_SLASHES, '');
  const faker = createMockFaker(options.seed);
  return sortedEndpoints().map((def) => buildHandler(baseUrl, def, faker));
}

/** Static paths register before parameterised ones so `/products/rates` beats `/products/:code`. */
function sortedEndpoints(): EndpointDef[] {
  const defs = Object.values(endpointRegistry).flatMap((endpoints) => Object.values(endpoints));
  return defs.sort((a, b) => paramCount(a.path) - paramCount(b.path));
}

function paramCount(path: string): number {
  return path.match(PATH_PARAM_PATTERN)?.length ?? 0;
}

function buildHandler(baseUrl: string, def: EndpointDef, faker: Faker): RequestHandler {
  const factory = HTTP_FACTORIES[def.method];
  return factory(`${baseUrl}${API_VERSION_PREFIX}${def.path}`, () => {
    if (def.response === undefined) {
      return new HttpResponse(null, { status: HTTP_STATUS_NO_CONTENT });
    }
    return HttpResponse.json(fabricate(def.response, faker) as JsonBodyType);
  });
}
