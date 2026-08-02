import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderOpenApiJson } from './openapi/document.js';

/**
 * `pnpm contracts:openapi` — generates `docs/api/openapi.json` from `@icb/contracts`.
 *
 * Modes:
 *   (default)   write the generated document to `docs/api/openapi.json`
 *   `--check`   exit 1 when the committed file differs from a fresh generation (for CI)
 */

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const OUTPUT_FILE = path.join(REPO_ROOT, 'docs', 'api', 'openapi.json');

const CHECK_FLAG = '--check';
const EXIT_OK = 0;
const EXIT_FAILURE = 1;
const EXIT_USAGE = 2;

const STALE_MESSAGE = [
  `docs/api/openapi.json is stale.`,
  `Run \`pnpm contracts:openapi\` and commit the result.`,
].join(' ');

function out(message: string): void {
  process.stdout.write(`${message}\n`);
}

function err(message: string): void {
  process.stderr.write(`${message}\n`);
}

async function writeDocument(): Promise<number> {
  await mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
  await writeFile(OUTPUT_FILE, renderOpenApiJson(), 'utf8');
  out(`Wrote ${path.relative(REPO_ROOT, OUTPUT_FILE)}`);
  return EXIT_OK;
}

async function checkDocument(): Promise<number> {
  const committed = await readFile(OUTPUT_FILE, 'utf8').catch(() => null);
  if (committed === null) {
    err(`docs/api/openapi.json is missing. ${STALE_MESSAGE}`);
    return EXIT_FAILURE;
  }
  if (committed !== renderOpenApiJson()) {
    err(STALE_MESSAGE);
    return EXIT_FAILURE;
  }
  out('docs/api/openapi.json is up to date.');
  return EXIT_OK;
}

async function main(args: readonly string[]): Promise<number> {
  const unknown = args.filter((arg) => arg !== CHECK_FLAG);
  if (unknown.length > 0) {
    err(`Unknown arguments: ${unknown.join(', ')}`);
    err('Usage: pnpm contracts:openapi [--check]');
    return EXIT_USAGE;
  }
  return args.includes(CHECK_FLAG) ? checkDocument() : writeDocument();
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (cause: unknown) => {
    const detail = cause instanceof Error ? cause.message : String(cause);
    err(`contracts:openapi failed unexpectedly: ${detail}`);
    process.exitCode = EXIT_FAILURE;
  },
);
