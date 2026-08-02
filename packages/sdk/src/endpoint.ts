import { type z } from 'zod';

import {
  type HttpMethod,
  type PathParams,
  type QueryParams,
  type RequestOptions,
} from './http.js';

/**
 * One API endpoint, declared once and consumed twice: the typed client builds a method from it
 * and `@icb/sdk/mock` builds an MSW handler from it. Path parameters use `:name` segments.
 */
export interface EndpointDef<B extends z.ZodType = z.ZodType, R = z.ZodType | never> {
  readonly method: HttpMethod;
  readonly path: string;
  readonly body?: B;
  /** `never` means the endpoint returns no content (204). */
  readonly response?: R;
  /** The transport attaches an `Idempotency-Key` header automatically (agent_plan.md N6). */
  readonly idempotent?: boolean;
  /** False for pre-auth endpoints (login, register, refresh…); default true. */
  readonly auth?: boolean;
}

interface BodyExtras<B extends z.ZodType = z.ZodType> {
  body?: B;
  idempotent?: boolean;
  auth?: boolean;
}

interface NoBodyExtras {
  idempotent?: boolean;
  auth?: boolean;
}

export function get<R extends z.ZodType>(
  path: string,
  response: R,
  extras?: NoBodyExtras,
): EndpointDef<z.ZodType, R> {
  return { method: 'GET', path, response, ...extras };
}

export function post<B extends z.ZodType, R extends z.ZodType>(
  path: string,
  response: R,
  extras: BodyExtras<B>,
): EndpointDef<B, R> {
  return { method: 'POST', path, response, ...extras };
}

export function postVoid<B extends z.ZodType>(
  path: string,
  extras?: BodyExtras<B>,
): EndpointDef<B, never> {
  return { method: 'POST', path, ...extras };
}

export function patch<B extends z.ZodType, R extends z.ZodType>(
  path: string,
  response: R,
  extras: BodyExtras<B>,
): EndpointDef<B, R> {
  return { method: 'PATCH', path, response, ...extras };
}

export function put<B extends z.ZodType, R extends z.ZodType>(
  path: string,
  response: R,
  extras: BodyExtras<B>,
): EndpointDef<B, R> {
  return { method: 'PUT', path, response, ...extras };
}

export function del(path: string, extras?: NoBodyExtras): EndpointDef<z.ZodType, never> {
  return { method: 'DELETE', path, ...extras };
}

/** The parsed response type of an endpoint: `z.output` of its schema, or `void`. */
export type ResponseOf<D extends EndpointDef> = [NonNullable<D['response']>] extends [never]
  ? void
  : NonNullable<D['response']> extends z.ZodType
    ? z.output<NonNullable<D['response']>>
    : void;

/** The accepted request body type of an endpoint: `z.input` of its schema, or `never`. */
export type BodyOf<D extends EndpointDef> = [NonNullable<D['body']>] extends [never]
  ? never
  : NonNullable<D['body']> extends z.ZodType
    ? z.input<NonNullable<D['body']>>
    : never;

export interface CallArgs<D extends EndpointDef> {
  params?: PathParams | undefined;
  query?: QueryParams | undefined;
  options?: RequestOptions | undefined;
  body?: BodyOf<D> | undefined;
}

/** The single typed entry point every endpoint method funnels through. */
export type Requester = <D extends EndpointDef>(
  def: D,
  args?: CallArgs<D>,
) => Promise<ResponseOf<D>>;
