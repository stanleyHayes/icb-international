import { format, resolveConfig } from 'prettier';
import { createDocument } from 'zod-openapi';
import type { ZodOpenApiPathsObject } from 'zod-openapi';

import { buildAllSchemas } from './components.js';
import {
  API_DESCRIPTION,
  API_TITLE,
  API_VERSION,
  BEARER_SCHEME_NAME,
  OPENAPI_OUTPUT_FILE,
  OPENAPI_VERSION,
  SERVER_DESCRIPTION,
  SERVER_URL,
  TAG,
} from './constants.js';
import { toOperation } from './operation.js';
import { ALL_OPERATIONS } from './routes/index.js';
import type { OperationSpec } from './spec.js';
import type { TagName } from './constants.js';

const JSON_INDENT = 2;

/** One-line description per bounded-context tag, surfaced in API docs and the SDK. */
const TAG_DESCRIPTIONS: Readonly<Record<TagName, string>> = {
  [TAG.auth]: 'Registration, login, and sessions.',
  [TAG.customers]: 'Customer profiles, preferences, and the staff 360° view.',
  [TAG.kyc]: 'Identity verification cases, documents, and the review queue.',
  [TAG.accounts]: 'Bank accounts, balances, holds, and lifecycle actions.',
  [TAG.transactions]: 'The customer-facing ledger: search, detail, export, insights.',
  [TAG.transfers]: 'Money movement: quotes, transfers, templates, standing orders.',
  [TAG.beneficiaries]: 'Saved payees with cooling-off and micro-deposit verification.',
  [TAG.budgets]: 'Per-category spending budgets evaluated against the ledger.',
  [TAG.cards]: 'Card issuing, controls, limits, PIN, and authorisations.',
  [TAG.lending]: 'Loan products, quotes, applications, and repayments.',
  [TAG.savings]: 'Savings goals and fixed-term deposits.',
  [TAG.payments]: 'Biller directory, linked bills, autopay, and bill payment.',
  [TAG.products]: 'Public product catalogue, rate table, and FX rates.',
  [TAG.documents]: 'Statements and generated documents with signed downloads.',
  [TAG.notifications]: 'The notification centre and per-channel preferences.',
  [TAG.support]: 'Support tickets and secure messaging.',
  [TAG.chat]: 'Live support chat for visitors and customers, with the staff inbox.',
  [TAG.disputes]: 'Chargeback disputes from filing to resolution.',
  [TAG.risk]: 'Fraud rules, cases, and AML alerting (staff).',
  [TAG.governance]: 'Staff administration, audit trail, and maker-checker approvals.',
  [TAG.admin]:
    'Ops KPIs, transaction monitor, manual postings, staff card operations, and ledger reports.',
  [TAG.simulation]: 'Simulation control: time travel, rails, scenarios (super-admin).',
  [TAG.system]: 'Operational health endpoints.',
  [TAG.content]: 'Published FAQ, branch and ATM locations, and content-managed rate entries.',
};

/** Builds the complete OpenAPI 3.1 document from the contract schemas and route tables. */
export function buildOpenApiDocument(): ReturnType<typeof createDocument> {
  return createDocument({
    openapi: OPENAPI_VERSION,
    info: {
      title: API_TITLE,
      version: API_VERSION,
      description: API_DESCRIPTION,
      license: { name: 'Proprietary' },
    },
    servers: [{ url: SERVER_URL, description: SERVER_DESCRIPTION }],
    tags: Object.values(TAG).map((name) => ({ name, description: TAG_DESCRIPTIONS[name] })),
    security: [{ [BEARER_SCHEME_NAME]: [] }],
    paths: buildPaths(ALL_OPERATIONS),
    components: {
      schemas: buildAllSchemas(),
      securitySchemes: {
        [BEARER_SCHEME_NAME]: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
  });
}

/**
 * The canonical serialisation, byte-identical between write mode and `--check`.
 *
 * The document is piped through Prettier (with the repository's own resolved config) so the
 * committed artifact satisfies both gates that read it: this package's `--check` staleness
 * comparison and the root `format:check`.
 */
export async function renderOpenApiJson(): Promise<string> {
  const raw = `${JSON.stringify(buildOpenApiDocument(), null, JSON_INDENT)}\n`;
  const config = (await resolveConfig(OPENAPI_OUTPUT_FILE)) ?? {};
  return format(raw, { ...config, parser: 'json' });
}

function buildPaths(operations: readonly OperationSpec[]): ZodOpenApiPathsObject {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const spec of operations) {
    const pathItem = paths[spec.path] ?? {};
    pathItem[spec.method] = toOperation(spec);
    paths[spec.path] = pathItem;
  }
  return paths;
}
