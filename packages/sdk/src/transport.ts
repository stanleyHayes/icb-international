import { type z } from 'zod';

import {
  API_VERSION_PREFIX,
  BEARER_SCHEME,
  HEADER_ACCEPT,
  HEADER_AUTHORIZATION,
  HEADER_CONTENT_TYPE,
  HEADER_IDEMPOTENCY_KEY,
  HTTP_STATUS_NO_CONTENT,
  HTTP_STATUS_UNAUTHORIZED,
  MIME_JSON,
} from './constants.js';
import { type CallArgs, type EndpointDef, type Requester, type ResponseOf } from './endpoint.js';
import { IcbNetworkError, IcbProtocolError, toApiError } from './errors.js';
import { type CredentialsMode, type RequestOptions } from './http.js';
import { resolveIdempotencyKey } from './idempotency.js';
import { interpolatePath, serializeQuery } from './query.js';
import { type Refresher } from './refresh.js';

const MAX_REPORTED_ISSUES = 5;
const ABORT_ERROR_NAME = 'AbortError';

/** Supplies the current access token; awaited before every authenticated request. */
export type AccessTokenProvider = () => string | null | Promise<string | null>;

export interface TransportDeps {
  baseUrl: string;
  fetchFn: typeof fetch;
  credentials: CredentialsMode;
  getAccessToken: AccessTokenProvider | undefined;
  refresher: Refresher;
}

interface Attempt {
  def: EndpointDef;
  url: string;
  init: RequestInit;
}

/** Builds the typed {@link Requester} all endpoint methods funnel through. */
export function createRequester(deps: TransportDeps): Requester {
  return async function request<D extends EndpointDef>(
    def: D,
    args?: CallArgs<D>,
  ): Promise<ResponseOf<D>> {
    const url = buildUrl(deps.baseUrl, def, args);
    const init = await buildInit(deps, def, args);
    const response = await send(deps, { def, url, init }, false);
    return parseResponse(def, response) as Promise<ResponseOf<D>>;
  };
}

function buildUrl(baseUrl: string, def: EndpointDef, args: CallArgs<EndpointDef> | undefined): string {
  const path = interpolatePath(def.path, args?.params);
  return `${baseUrl}${API_VERSION_PREFIX}${path}${serializeQuery(args?.query)}`;
}

async function buildInit(
  deps: TransportDeps,
  def: EndpointDef,
  args: CallArgs<EndpointDef> | undefined,
): Promise<RequestInit> {
  const headers = await buildHeaders(deps, def, args);
  return {
    method: def.method,
    headers,
    credentials: deps.credentials,
    signal: args?.options?.signal ?? null,
    body: args?.body === undefined ? null : JSON.stringify(args.body),
  };
}

async function buildHeaders(
  deps: TransportDeps,
  def: EndpointDef,
  args: CallArgs<EndpointDef> | undefined,
): Promise<Record<string, string>> {
  const headers: Record<string, string> = { [HEADER_ACCEPT]: MIME_JSON };
  Object.assign(headers, await authHeader(deps, def));
  Object.assign(headers, idempotencyHeader(def, args?.options));
  if (args?.body !== undefined) headers[HEADER_CONTENT_TYPE] = MIME_JSON;
  Object.assign(headers, args?.options?.headers);
  return headers;
}

async function authHeader(deps: TransportDeps, def: EndpointDef): Promise<Record<string, string>> {
  if (def.auth === false) return {};
  const token = await deps.getAccessToken?.();
  return token ? { [HEADER_AUTHORIZATION]: `${BEARER_SCHEME} ${token}` } : {};
}

function idempotencyHeader(def: EndpointDef, options: RequestOptions | undefined): Record<string, string> {
  if (def.idempotent !== true) return {};
  return { [HEADER_IDEMPOTENCY_KEY]: resolveIdempotencyKey(options?.idempotencyKey) };
}

/** Sends one attempt; on a 401 refreshes the token (single-flight) and retries exactly once. */
async function send(deps: TransportDeps, attempt: Attempt, retried: boolean): Promise<Response> {
  const response = await fetchSafe(deps, attempt);
  const canRefresh =
    response.status === HTTP_STATUS_UNAUTHORIZED && attempt.def.auth !== false && !retried;
  if (!canRefresh) {
    if (!response.ok) throw await toApiError(response);
    return response;
  }
  const token = await deps.refresher.refresh();
  const retryHeaders = new Headers(attempt.init.headers);
  retryHeaders.set(HEADER_AUTHORIZATION, `${BEARER_SCHEME} ${token}`);
  return send(deps, { ...attempt, init: { ...attempt.init, headers: retryHeaders } }, true);
}

async function fetchSafe(deps: TransportDeps, attempt: Attempt): Promise<Response> {
  try {
    return await deps.fetchFn(attempt.url, attempt.init);
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === ABORT_ERROR_NAME) throw cause;
    throw new IcbNetworkError(cause);
  }
}

async function parseResponse(def: EndpointDef, response: Response): Promise<unknown> {
  if (def.response === undefined || response.status === HTTP_STATUS_NO_CONTENT) return undefined;
  const body: unknown = await response.json().catch(() => {
    throw new IcbProtocolError('expected a JSON body');
  });
  const parsed = def.response.safeParse(body);
  if (!parsed.success) throw new IcbProtocolError(summariseIssues(parsed.error));
  return parsed.data;
}

function summariseIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, MAX_REPORTED_ISSUES)
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('; ');
}
