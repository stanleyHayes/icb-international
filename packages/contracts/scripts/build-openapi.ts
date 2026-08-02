import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { OPENAPI_OUTPUT_FILE, REPO_ROOT } from './openapi/constants.js';
import { renderOpenApiJson } from './openapi/document.js';

/**
 * `pnpm contracts:openapi` — generates `docs/api/openapi.json` from `@icb/contracts`.
 *
 * Modes:
 *   (default)   write the generated document to `docs/api/openapi.json`
 *   `--check`   exit 1 when the committed file differs from a fresh generation (for CI)
 */

const CHECK_FLAG = '--check';
const EXIT_OK = 0;
const EXIT_FAILURE = 1;
const EXIT_USAGE = 2;

const OUTPUT_LABEL = path.relative(REPO_ROOT, OPENAPI_OUTPUT_FILE);

const STALE_MESSAGE = [
  `${OUTPUT_LABEL} is stale.`,
  `Run \`pnpm contracts:openapi\` and commit the result.`,
].join(' ');

function out(message: string): void {
  process.stdout.write(`${message}\n`);
}

function err(message: string): void {
  process.stderr.write(`${message}\n`);
}

async function writeDocument(): Promise<number> {
  await mkdir(path.dirname(OPENAPI_OUTPUT_FILE), { recursive: true });
  await writeFile(OPENAPI_OUTPUT_FILE, await renderOpenApiJson(), 'utf8');
  out(`Wrote ${OUTPUT_LABEL}`);
  return EXIT_OK;
}

async function checkDocument(): Promise<number> {
  const committed = await readFile(OPENAPI_OUTPUT_FILE, 'utf8').catch(() => null);
  if (committed === null) {
    err(`${OUTPUT_LABEL} is missing. ${STALE_MESSAGE}`);
    return EXIT_FAILURE;
  }
  if (committed !== (await renderOpenApiJson())) {
    err(STALE_MESSAGE);
    return EXIT_FAILURE;
  }
  out(`${OUTPUT_LABEL} is up to date.`);
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
