#!/usr/bin/env node
/**
 * migrate.mjs — minimal, versioned MongoDB migration runner for ICB.
 *
 * Migrations live in tools/scripts/migrations/<NNNN>-<slug>.mjs and export:
 *
 *   export async function up(db)   { ... }   // apply
 *   export async function down(db) { ... }   // reverse
 *
 * Applied migrations are recorded in the `_migrations` collection with a checksum, so a
 * migration that is edited after being applied fails loudly instead of drifting silently.
 *
 * Usage:
 *   node tools/scripts/migrate.mjs status          # pending vs applied
 *   node tools/scripts/migrate.mjs up              # apply all pending, in order
 *   node tools/scripts/migrate.mjs down [n]        # roll back the last n (default 1)
 *   node tools/scripts/migrate.mjs create <slug>   # scaffold a new migration file
 *
 * Connection: MONGO_URI from the environment, falling back to .env. Runs against whatever
 * MongoDB that URI points at — the compose service included. Boot-time auto-run behind a
 * flag is deliberately NOT wired here: that hook belongs to the API bootstrap (BE-01),
 * which owns apps/api. Until then, run it manually or from deploy scripts.
 */
import { createHash } from 'node:crypto';
import { readdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { MongoClient } from 'mongodb';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '../..');
const migrationsDir = resolve(scriptDir, 'migrations');
const MIGRATION_FILE = /^(\d{4,})-([a-z0-9-]+)\.mjs$/;

function mongoUri() {
  if (process.env.MONGO_URI) return process.env.MONGO_URI;
  try {
    process.loadEnvFile(resolve(repoRoot, '.env'));
  } catch {
    // No .env — fall through to the default and let connect() report the real problem.
  }
  return (
    process.env.MONGO_URI ?? 'mongodb://localhost:27217/icb?replicaSet=icb-rs&directConnection=true'
  );
}

async function listMigrations() {
  const files = await readdir(migrationsDir).catch(() => []);
  return files
    .map((file) => {
      const match = MIGRATION_FILE.exec(file);
      return match ? { file, id: file.replace(/\.mjs$/, '') } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.id.localeCompare(b.id));
}

function checksum(source) {
  return createHash('sha256').update(source).digest('hex');
}

async function loadMigration(file) {
  const module = await import(pathToFileURL(resolve(migrationsDir, file)).href);
  if (typeof module.up !== 'function' || typeof module.down !== 'function') {
    throw new Error(`${file}: a migration must export async up(db) and down(db)`);
  }
  return module;
}

async function withDb(run) {
  const client = new MongoClient(mongoUri(), { serverSelectionTimeoutMS: 8000 });
  await client.connect();
  try {
    const tracker = client.db().collection('_migrations');
    // _id uniqueness is built in; no index to create.
    return await run(client.db(), tracker);
  } finally {
    await client.close();
  }
}

async function status() {
  return withDb(async (_db, tracker) => {
    const applied = new Map((await tracker.find().toArray()).map((row) => [row._id, row]));
    const migrations = await listMigrations();
    if (migrations.length === 0) {
      console.log('No migrations found in tools/scripts/migrations/.');
      return;
    }
    for (const migration of migrations) {
      const row = applied.get(migration.id);
      console.log(
        `  ${row ? '✓ applied ' : '· pending '} ${migration.id}${row ? `  (${row.appliedAt})` : ''}`,
      );
    }
  });
}

async function up() {
  return withDb(async (db, tracker) => {
    const applied = new Map((await tracker.find().toArray()).map((row) => [row._id, row]));
    let count = 0;
    for (const migration of await listMigrations()) {
      const row = applied.get(migration.id);
      if (row) {
        const module = await loadMigration(migration.file);
        const actual = checksum(module.up.toString() + module.down.toString());
        if (row.checksum !== actual) {
          throw new Error(
            `${migration.id} was edited after being applied (checksum mismatch). ` +
              'Reverting history by hand is safer than rewriting it: add a new migration.',
          );
        }
        continue;
      }
      const module = await loadMigration(migration.file);
      const started = Date.now();
      await module.up(db);
      await tracker.insertOne({
        _id: migration.id,
        appliedAt: new Date().toISOString(),
        durationMs: Date.now() - started,
        checksum: checksum(module.up.toString() + module.down.toString()),
      });
      console.log(`  ✓ ${migration.id} (${Date.now() - started}ms)`);
      count += 1;
    }
    console.log(count === 0 ? 'Already up to date.' : `Applied ${count} migration(s).`);
  });
}

async function down(steps) {
  return withDb(async (db, tracker) => {
    // Newest first: roll back in reverse application order.
    const applied = await tracker.find().sort({ _id: -1 }).limit(steps).toArray();
    if (applied.length === 0) {
      console.log('Nothing to roll back.');
      return;
    }
    for (const row of applied) {
      const file = `${row._id}.mjs`;
      const module = await loadMigration(file);
      await module.down(db);
      await tracker.deleteOne({ _id: row._id });
      console.log(`  ✓ rolled back ${row._id}`);
    }
  });
}

async function create(slug) {
  if (!/^[a-z0-9-]+$/.test(slug)) {
    throw new Error(`slug must be lowercase letters, digits and dashes: got "${slug}"`);
  }
  const existing = await listMigrations();
  const next = String(existing.length === 0 ? 1 : Number.parseInt(existing.at(-1).id, 10) + 1);
  const id = `${next.padStart(4, '0')}-${slug}`;
  const path = resolve(migrationsDir, `${id}.mjs`);
  await writeFile(
    path,
    `/**\n * Migration ${id}.\n *\n * up() applies, down() reverses. Both receive a connected mongodb Db\n * and must be safe to run once — the runner records applied migrations in\n * _migrations and will refuse to re-run them.\n */\nexport async function up(db) {\n  // await db.collection('...').updateMany(...);\n}\n\nexport async function down(db) {\n  // await db.collection('...').updateMany(...);\n}\n`,
  );
  console.log(`Created tools/scripts/migrations/${id}.mjs`);
}

const [command, ...args] = process.argv.slice(2);
try {
  switch (command) {
    case 'status':
      await status();
      break;
    case 'up':
      await up();
      break;
    case 'down':
      await down(args[0] ? Number.parseInt(args[0], 10) : 1);
      break;
    case 'create':
      if (!args[0]) throw new Error('usage: migrate.mjs create <slug>');
      await create(args[0]);
      break;
    default:
      console.log('usage: migrate.mjs status | up | down [n] | create <slug>');
      process.exitCode = command ? 2 : 0;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
