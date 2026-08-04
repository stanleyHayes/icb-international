/**
 * Global setup for the SEC-02 suite.
 *
 * The app's dev `REDIS_URL` points at a port nothing listens on. Booting BullMQ workers against
 * it works (connections are lazy) but is noisy and slows teardown, so when a `redis-server`
 * binary is available we spawn a private, persistence-free instance on a test-only port and
 * publish its URL for the worker processes. When no binary exists the suite degrades to the
 * application's own dead-Redis tolerance — that is an environment fact, not a failure.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { writeFileSync, rmSync } from 'node:fs';
import net from 'node:net';

import { INFRA_STATE_PATH } from './infra-state.js';

const PORT_RANGE_START = 6579;
const PORT_RANGE_END = 6599;
const REDIS_READY_PATTERN = /Ready to accept connections/;
const READY_TIMEOUT_MS = 10_000;

export default async function globalSetup(): Promise<() => void> {
  const redis = await trySpawnRedis();
  writeFileSync(INFRA_STATE_PATH, JSON.stringify({ redisUrl: redis?.url ?? null }));

  return () => {
    redis?.child.kill('SIGTERM');
    rmSync(INFRA_STATE_PATH, { force: true });
  };
}

interface SpawnedRedis {
  readonly child: ChildProcess;
  readonly url: string;
}

async function trySpawnRedis(): Promise<SpawnedRedis | null> {
  for (let port = PORT_RANGE_START; port <= PORT_RANGE_END; port += 1) {
    if (await portFree(port)) {
      const spawned = await spawnOnPort(port);
      if (spawned) {
        return spawned;
      }
    }
  }
  return null;
}

function portFree(port: number): Promise<boolean> {
  return new Promise((resolvePromise) => {
    const probe = net.createConnection({ port, host: '127.0.0.1' });
    probe.once('connect', () => {
      probe.destroy();
      resolvePromise(false);
    });
    probe.once('error', () => resolvePromise(true));
  });
}

function spawnOnPort(port: number): Promise<SpawnedRedis | null> {
  return new Promise((resolvePromise) => {
    let child: ChildProcess;
    try {
      // eslint-disable-next-line sonarjs/no-os-command-from-path -- dev-machine tooling resolved via PATH by design, never a deployable
      child = spawn('redis-server', [
        '--port',
        String(port),
        '--bind',
        '127.0.0.1',
        '--save',
        '',
        '--appendonly',
        'no',
      ]);
    } catch {
      resolvePromise(null);
      return;
    }
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      resolvePromise(null);
    }, READY_TIMEOUT_MS);
    child.stdout?.on('data', (chunk: Buffer) => {
      if (REDIS_READY_PATTERN.test(chunk.toString())) {
        clearTimeout(timer);
        resolvePromise({ child, url: `redis://127.0.0.1:${port}` });
      }
    });
    child.once('error', () => {
      clearTimeout(timer);
      resolvePromise(null);
    });
  });
}
