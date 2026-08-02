/**
 * Copies brand/tokens/tokens.css into this package as tokens.css.
 *
 * brand/tokens/colors.json is the single source of truth for design tokens (see ADR-10); the
 * build step re-exports the generated CSS through @icb/config-tailwind so consumers can
 * `@import '@icb/config-tailwind/tokens.css'` instead of reaching across the repo with a
 * relative path that breaks once the package is packed.
 */
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = resolve(packageRoot, '../../brand/tokens/tokens.css');
const targetPath = resolve(packageRoot, 'tokens.css');

const source = await readFile(sourcePath, 'utf8');
await mkdir(dirname(targetPath), { recursive: true });
await copyFile(sourcePath, targetPath);

const written = await readFile(targetPath, 'utf8');
if (written !== source) {
  throw new Error(`token copy mismatch: ${targetPath} differs from ${sourcePath}`);
}
console.log(`@icb/config-tailwind: copied ${sourcePath} -> ${targetPath}`);
