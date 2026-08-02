import type { z } from 'zod';

import type { StatusCode, TagName } from './constants.js';

/**
 * The declarative shape every route table is written in.
 *
 * One `OperationSpec` becomes one OpenAPI operation. Route tables (see `routes/`) are pure
 * data; the conversion to zod-openapi objects lives in `operation.ts`.
 */

export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

export interface SuccessResponse {
  readonly status: StatusCode;
  readonly description: string;
  /** Absent for 204-style responses with no body. */
  readonly schema?: z.ZodType;
}

export interface ErrorResponseSpec {
  readonly status: StatusCode;
  /** Overrides the default prose from `ERROR_DESCRIPTIONS` when the cause is specific. */
  readonly description?: string;
}

export interface OperationSpec {
  readonly method: HttpMethod;
  /** Path template relative to the `/v1` server, e.g. `/accounts/{accountId}`. */
  readonly path: string;
  readonly tag: TagName;
  readonly operationId: string;
  readonly summary: string;
  /** JSON request body schema. */
  readonly request?: z.ZodType;
  /** Query string schema — each property becomes one parameter. */
  readonly query?: z.ZodType;
  /** Path parameters, in template order. Almost always a ULID `idSchema`. */
  readonly pathParams?: Readonly<Record<string, z.ZodType>>;
  readonly response: SuccessResponse;
  /** Error statuses beyond the defaults implied by `auth` and `request`. */
  readonly errors?: readonly ErrorResponseSpec[];
  /** Defaults to true. Public routes (catalogue, rates, auth entry points) set false. */
  readonly auth?: boolean;
  /** Requires the `Idempotency-Key` header (agent_plan.md N6). */
  readonly idempotent?: boolean;
}

/** Identity helper so route tables get excess-property checking. */
export function defineOperations(specs: readonly OperationSpec[]): readonly OperationSpec[] {
  return specs;
}

/** Builds a success response entry with less boilerplate. */
export function success(
  status: StatusCode,
  description: string,
  schema?: z.ZodType,
): SuccessResponse {
  return schema === undefined ? { status, description } : { status, description, schema };
}
