import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { endpointRegistry } from '../../../sdk/src/endpoints/index.js';
import { type EndpointDef } from '../../../sdk/src/endpoint.js';
import { toComponentName } from '../openapi/components.js';
import { OPENAPI_OUTPUT_FILE, TAG } from '../openapi/constants.js';
import { buildOpenApiDocument, renderOpenApiJson } from '../openapi/document.js';
import { ALL_OPERATIONS } from '../openapi/routes/index.js';

const COMMITTED_FILE = OPENAPI_OUTPUT_FILE;

/** Minimal structural view of the generated document — enough to assert against. */
interface TestParameter {
  in?: string;
  name?: string;
  required?: boolean;
}

interface TestMediaType {
  schema?: { $ref?: string };
}

interface TestResponse {
  content?: Record<string, TestMediaType>;
}

interface TestOperation {
  operationId?: string;
  summary?: string;
  tags?: string[];
  security?: unknown[];
  parameters?: TestParameter[];
  responses?: Record<string, TestResponse>;
}

interface TestSchema {
  type?: string;
  properties?: Record<string, { type?: string }>;
  required?: string[];
}

interface TestDocument {
  openapi: string;
  info: { title: string; version: string };
  servers: { url: string }[];
  tags: { name: string }[];
  security: unknown[];
  paths: Record<string, Record<string, TestOperation>>;
  components: {
    schemas: Record<string, TestSchema>;
    securitySchemes: Record<string, unknown>;
  };
}

interface BoundaryShape {
  method: string;
  path: string;
  auth: boolean | undefined;
  idempotent: boolean | undefined;
  hasBody: boolean;
  hasQuery: boolean;
  hasResponse: boolean;
}

const document = buildOpenApiDocument() as unknown as TestDocument;
const { paths } = document;

function allOperations(): [string, string, TestOperation][] {
  return Object.entries(paths).flatMap(([pathTemplate, item]) =>
    Object.entries(item).map(([method, operation]): [string, string, TestOperation] => [
      pathTemplate,
      method,
      operation,
    ]),
  );
}

function collectRefs(node: unknown, found: string[] = []): string[] {
  if (Array.isArray(node)) {
    node.forEach((child) => collectRefs(child, found));
  } else if (node !== null && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      if (key === '$ref' && typeof value === 'string') found.push(value);
      else collectRefs(value, found);
    }
  }
  return found;
}

function resolveRef(ref: string): unknown {
  return ref
    .replace('#/', '')
    .split('/')
    .reduce<unknown>((node, part) => {
      if (node !== null && typeof node === 'object') {
        return (node as Record<string, unknown>)[part];
      }
      return undefined;
    }, document);
}

function toSpecBoundaryShape(): BoundaryShape[] {
  return ALL_OPERATIONS.map((operation) => ({
    method: operation.method,
    path: operation.path,
    auth: operation.auth,
    idempotent: operation.idempotent,
    hasBody: operation.request !== undefined,
    hasQuery: operation.query !== undefined,
    hasResponse: operation.response.schema !== undefined,
  }));
}

function toSdkBoundaryShape(): BoundaryShape[] {
  const namespaces = Object.values(endpointRegistry) as Record<string, EndpointDef>[];
  return namespaces.flatMap((namespace) =>
    Object.values(namespace).map((endpoint) => ({
      method: endpoint.method.toLowerCase(),
      path: endpoint.path.replace(/:(\w+)/g, '{$1}'),
      auth: endpoint.auth,
      idempotent: endpoint.idempotent,
      hasBody: endpoint.body !== undefined,
      hasQuery: endpoint.query !== undefined,
      hasResponse: endpoint.response !== undefined,
    })),
  );
}

function byOperationKey(item: Pick<BoundaryShape, 'method' | 'path'>): string {
  return `${item.method} ${item.path}`;
}

function sortedKeys(map: ReadonlyMap<string, BoundaryShape>): string[] {
  return [...map.keys()].sort((left, right) => left.localeCompare(right));
}

function expectMatchingBoundaryShape(
  key: string,
  sdk: BoundaryShape,
  spec: BoundaryShape | undefined,
) {
  expect(spec, key).toBeDefined();
  expect(spec?.auth ?? true, `${key} auth`).toBe(sdk.auth ?? true);
  expect(spec?.idempotent ?? false, `${key} idempotent`).toBe(sdk.idempotent ?? false);
  expect(spec?.hasBody, `${key} body`).toBe(sdk.hasBody);
  expect(spec?.hasQuery, `${key} query`).toBe(sdk.hasQuery);
  expect(spec?.hasResponse, `${key} response`).toBe(sdk.hasResponse);
}

function expectAlignedBoundaryShape() {
  const sdkMap = new Map(toSdkBoundaryShape().map((item) => [byOperationKey(item), item]));
  const specMap = new Map(toSpecBoundaryShape().map((item) => [byOperationKey(item), item]));

  expect(sortedKeys(sdkMap)).toEqual(sortedKeys(specMap));

  for (const [key, sdk] of sdkMap) {
    expectMatchingBoundaryShape(key, sdk, specMap.get(key));
  }
}

describe('document envelope', () => {
  it('declares OpenAPI 3.1 with info, server, and tags per bounded context', () => {
    expect(document.openapi).toMatch(/^3\.1\.\d+$/);
    expect(document.info.title).toBe('ICB API');
    expect(document.info.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(document.servers[0]?.url).toContain('/v1');
    expect(document.tags).toHaveLength(Object.keys(TAG).length);
  });

  it('defines the Bearer JWT scheme and applies it globally', () => {
    expect(document.components.securitySchemes['bearerAuth']).toEqual({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    });
    expect(document.security).toEqual([{ bearerAuth: [] }]);
  });

  // Renders the whole document through prettier — twice, to prove determinism. That is real
  // work measured at several seconds, so it carries its own budget rather than relying on
  // vitest's 5s default, which it exceeds the moment the machine is under any other load.
  it('serialises deterministically as parseable JSON with a trailing newline', { timeout: 30_000 }, async () => {
    const rendered = await renderOpenApiJson();
    expect(rendered.endsWith('}\n')).toBe(true);
    expect(() => JSON.parse(rendered) as unknown).not.toThrow();
    expect(await renderOpenApiJson()).toBe(rendered);
  });
});

describe('operations', () => {
  it('covers every bounded context', () => {
    const tagsInUse = new Set(ALL_OPERATIONS.map((spec) => spec.tag));
    expect(tagsInUse.size).toBe(Object.keys(TAG).length);
  });

  it('gives every operation a unique operationId, a tag, and a 2xx response', () => {
    const operations = allOperations();
    const ids = operations.map(([, , op]) => op.operationId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const [pathTemplate, method, op] of operations) {
      expect(op.summary, `${method} ${pathTemplate}`).toBeTruthy();
      expect(op.tags, op.operationId).toHaveLength(1);
      expect(
        Object.keys(op.responses ?? {}).some((code) => code.startsWith('2')),
        `${op.operationId ?? 'operation'} needs a 2xx response`,
      ).toBe(true);
    }
  });

  it('marks public entry points as unauthenticated and inherits Bearer elsewhere', () => {
    for (const [, , op] of allOperations()) {
      if (op.security !== undefined) expect(op.security).toEqual([]);
    }
    expect(paths['/auth/login']?.post?.security).toEqual([]);
    expect(paths['/products']?.get?.security).toEqual([]);
    expect(paths['/auth/me']?.get?.security).toBeUndefined();
  });

  it('requires Idempotency-Key on every mutating money endpoint', () => {
    const moneyEndpoints: [string, string][] = [
      ['/transfers', 'post'],
      ['/transfers/bulk', 'post'],
      ['/bills/{billId}/pay', 'post'],
      ['/accounts/{accountId}/close', 'post'],
      ['/loans/applications', 'post'],
      ['/loans/applications/{applicationId}/accept', 'post'],
      ['/loans/{loanId}/repayments', 'post'],
      ['/savings/goals/{goalId}/contribute', 'post'],
      ['/savings/deposits', 'post'],
      ['/savings/deposits/{depositId}/break', 'post'],
      ['/admin/postings', 'post'],
    ];
    for (const [pathTemplate, method] of moneyEndpoints) {
      const operation = paths[pathTemplate]?.[method];
      const header = operation?.parameters?.find(
        (param) => param.in === 'header' && param.name === 'Idempotency-Key',
      );
      expect(header, `${method} ${pathTemplate}`).toMatchObject({ required: true });
    }
  });

  it('stays aligned with the SDK endpoint registry on path, method, and boundary flags', () => {
    expectAlignedBoundaryShape();
  });
});

describe('error contract', () => {
  it('returns RFC 9457 problem+json for every error response', () => {
    for (const [, , op] of allOperations()) {
      for (const [code, response] of Object.entries(op.responses ?? {})) {
        if (code.startsWith('2')) continue;
        const media = response.content?.['application/problem+json'];
        expect(media, `${op.operationId ?? 'operation'} ${code}`).toBeDefined();
        expect(media?.schema?.$ref).toBe('#/components/schemas/ProblemDetails');
      }
    }
  });

  it('always offers 429 and 500, and 401 on authenticated routes', () => {
    for (const [, , op] of allOperations()) {
      expect(op.responses?.['429'], op.operationId).toBeDefined();
      expect(op.responses?.['500'], op.operationId).toBeDefined();
      if (op.security === undefined) {
        expect(op.responses?.['401'], op.operationId).toBeDefined();
      }
    }
  });
});

describe('components', () => {
  it('resolves every $ref in the document', () => {
    const missing = collectRefs(document).filter((ref) => resolveRef(ref) === undefined);
    expect(missing).toEqual([]);
  });

  it('keeps money an integer of minor units', () => {
    const money = document.components.schemas['Money'];
    expect(money?.properties?.['minorUnits']?.type).toBe('integer');
    expect(money?.required).toEqual(['minorUnits', 'currency', 'scale']);
  });

  it('derives PascalCase component names with explicit overrides', () => {
    expect(toComponentName('registerRequestSchema')).toBe('RegisterRequest');
    expect(toComponentName('moneySchema')).toBe('Money');
    expect(toComponentName('idSchema')).toBe('Ulid');
    expect(toComponentName('documentSchema')).toBe('BankDocument');
  });

  it('registers page wrappers for the list endpoints', () => {
    expect(document.components.schemas['TransactionSummaryPage']?.properties).toHaveProperty(
      'items',
    );
    expect(document.components.schemas['KycCasePage']?.properties).toHaveProperty('totalPages');
  });
});

describe('committed artifact', () => {
  it('docs/api/openapi.json matches a fresh generation (the --check contract)', { timeout: 30_000 }, async () => {
    const committed = readFileSync(COMMITTED_FILE, 'utf8');
    expect(committed).toBe(await renderOpenApiJson());
  });
});
