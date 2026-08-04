import fs from 'node:fs';
import path from 'node:path';

import type { ViolationRecord } from './support/axe';
import { RESULTS_DIR } from './support/paths';

/**
 * Merge the per-worker violation files into results/violations.json and print the
 * severity breakdown that the findings report is built from.
 */
export default async function globalTeardown(): Promise<void> {
  if (!fs.existsSync(RESULTS_DIR)) {
    return;
  }
  const merged: ViolationRecord[] = [];
  for (const file of fs.readdirSync(RESULTS_DIR)) {
    if (!/^violations-[a-z]+-\d+\.json$/.test(file)) {
      continue;
    }
    merged.push(
      ...(JSON.parse(fs.readFileSync(path.join(RESULTS_DIR, file), 'utf8')) as ViolationRecord[]),
    );
    fs.unlinkSync(path.join(RESULTS_DIR, file));
  }
  fs.writeFileSync(path.join(RESULTS_DIR, 'violations.json'), JSON.stringify(merged, null, 2));

  // Keep every run's merge: rerunning a single project must not erase the full picture.
  const historyDir = path.join(RESULTS_DIR, 'history');
  fs.mkdirSync(historyDir, { recursive: true });
  const stamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
  fs.writeFileSync(
    path.join(historyDir, `violations-${stamp}.json`),
    JSON.stringify(merged, null, 2),
  );

  const byImpact = new Map<string, number>();
  for (const record of merged) {
    byImpact.set(record.impact, (byImpact.get(record.impact) ?? 0) + 1);
  }
  const summary = [...byImpact.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([impact, count]) => `${impact}: ${count}`)
    .join(', ');
  console.log(`[a11y] ${merged.length} violation instance(s) — ${summary || 'none'}`);
}
