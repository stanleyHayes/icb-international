import fs from 'node:fs';
import path from 'node:path';

import { AxeBuilder } from '@axe-core/playwright';
import type { Page } from 'playwright/test';

import { RESULTS_DIR } from './paths';

/**
 * axe-core wrapper: WCAG 2.2 A/AA scan, violation collection for the findings report.
 *
 * The gate is zero serious/critical violations per route (agent_plan.md §10). Lower-impact
 * violations are still recorded — the global teardown merges every worker's JSON into
 * results/violations.json, which docs/a11y-findings.md is triaged from.
 */

export interface ViolationRecord {
  readonly app: string;
  readonly route: string;
  readonly ruleId: string;
  readonly impact: string;
  readonly help: string;
  readonly helpUrl: string;
  readonly nodes: readonly string[];
}

export const GATE_IMPACTS = new Set(['serious', 'critical']);

const EXCLUDE_SELECTORS = [
  // Next.js dev-mode overlay is tooling chrome, not product UI; production builds lack it.
  'nextjs-portal',
  '#__next-build-indicator',
];

export async function scanPage(page: Page, app: string, route: string): Promise<ViolationRecord[]> {
  let builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']);
  for (const selector of EXCLUDE_SELECTORS) {
    builder = builder.exclude(selector);
  }
  const results = await builder.analyze();
  const records: ViolationRecord[] = results.violations.map((violation) => ({
    app,
    route,
    ruleId: violation.id,
    impact: violation.impact ?? 'unknown',
    help: violation.help,
    helpUrl: violation.helpUrl,
    nodes: violation.nodes.slice(0, 5).map((node) => node.target.join(' ')),
  }));
  persist(app, records);
  return records;
}

function persist(app: string, records: ViolationRecord[]): void {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const file = path.join(RESULTS_DIR, `violations-${app}-${process.pid}.json`);
  const prior: ViolationRecord[] = fs.existsSync(file)
    ? (JSON.parse(fs.readFileSync(file, 'utf8')) as ViolationRecord[])
    : [];
  fs.writeFileSync(file, JSON.stringify([...prior, ...records], null, 2));
}

export function seriousOrCritical(records: readonly ViolationRecord[]): ViolationRecord[] {
  return records.filter((record) => GATE_IMPACTS.has(record.impact));
}

export function formatViolation(record: ViolationRecord): string {
  const nodes = record.nodes.map((node) => `      at ${node}`).join('\n');
  return `  [${record.impact}] ${record.ruleId}: ${record.help}\n${nodes}`;
}
