import type {
  ZodOpenApiOperationObject,
  ZodOpenApiParameters,
  ZodOpenApiResponseObject,
  ZodOpenApiResponsesObject,
} from 'zod-openapi';
import { z } from 'zod';

import { problemDetailsSchema } from '../../src/common/errors.js';
import { idempotencyKeySchema } from '../../src/common/primitives.js';
import {
  ERROR_DESCRIPTIONS,
  IDEMPOTENCY_HEADER,
  JSON_MEDIA_TYPE,
  PROBLEM_MEDIA_TYPE,
  STATUS,
} from './constants.js';
import type { ErrorResponseSpec, OperationSpec, SuccessResponse } from './spec.js';

const GENERIC_ERROR_DESCRIPTION = 'The request failed.';
const NO_SECURITY: readonly never[] = [];

/** Converts one declarative spec into a zod-openapi operation object. */
export function toOperation(spec: OperationSpec): ZodOpenApiOperationObject {
  return {
    operationId: spec.operationId,
    summary: spec.summary,
    tags: [spec.tag],
    ...(spec.auth === false ? { security: [...NO_SECURITY] } : {}),
    ...buildRequestParams(spec),
    ...(spec.request === undefined ? {} : { requestBody: jsonBody(spec.request) }),
    responses: buildResponses(spec),
  };
}

function buildRequestParams(spec: OperationSpec): {
  requestParams?: ZodOpenApiParameters;
} {
  const params: ZodOpenApiParameters = {};
  if (spec.pathParams !== undefined) params.path = z.object(spec.pathParams);
  if (spec.query !== undefined) params.query = asParamObject(spec.query);
  if (spec.idempotent === true) {
    params.header = z.object({ [IDEMPOTENCY_HEADER]: idempotencyKeySchema });
  }
  return Object.keys(params).length === 0 ? {} : { requestParams: params };
}

/** Query schemas are always Zod objects; the library's parameter input type is narrower. */
function asParamObject(schema: z.ZodType): ZodOpenApiParameters['query'] {
  return schema as z.ZodType<unknown, Record<string, unknown>>;
}

function jsonBody(schema: z.ZodType): { content: Record<string, { schema: z.ZodType }> } {
  return { content: { [JSON_MEDIA_TYPE]: { schema } } };
}

function buildResponses(spec: OperationSpec): ZodOpenApiResponsesObject {
  const responses: Record<string, ZodOpenApiResponseObject> = {};
  responses[String(spec.response.status)] = successResponse(spec.response);
  for (const error of collectErrors(spec)) {
    responses[String(error.status)] = problemResponse(error);
  }
  return responses;
}

/** Default error set: auth implies 401/403; every route can be throttled or fail. */
function collectErrors(spec: OperationSpec): readonly ErrorResponseSpec[] {
  const merged = new Map<number, ErrorResponseSpec>();
  if (spec.auth !== false) {
    merged.set(STATUS.unauthorized, { status: STATUS.unauthorized });
    merged.set(STATUS.forbidden, { status: STATUS.forbidden });
  }
  merged.set(STATUS.tooManyRequests, { status: STATUS.tooManyRequests });
  merged.set(STATUS.internalError, { status: STATUS.internalError });
  for (const error of spec.errors ?? []) merged.set(error.status, error);
  return [...merged.values()];
}

function successResponse(response: SuccessResponse): ZodOpenApiResponseObject {
  return {
    description: response.description,
    ...(response.schema === undefined ? {} : jsonBody(response.schema)),
  };
}

function problemResponse(error: ErrorResponseSpec): ZodOpenApiResponseObject {
  return {
    description: error.description ?? ERROR_DESCRIPTIONS[error.status] ?? GENERIC_ERROR_DESCRIPTION,
    content: { [PROBLEM_MEDIA_TYPE]: { schema: problemDetailsSchema } },
  };
}
