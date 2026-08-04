import { connect } from 'node:net';

/**
 * Redis reachability probe.
 *
 * `.env` points at :6479, which is only up when the compose stack is. Something else may answer
 * on :6379 (a local install, another agent's stack). The integration suite needs a working
 * Redis only so BullMQ workers boot cleanly — the money paths under test never touch the cache
 * or a queue — so we pick the first candidate that PONGs and otherwise leave the configured
 * value in place: the cache degrades to straight-to-database reads by design.
 */

const PING_TIMEOUT_MS = 750;

/** True when a Redis (or anything speaking RESP) answers PING at `url`. */
export async function redisPings(url: string): Promise<boolean> {
  let host: string;
  let port: number;
  try {
    const parsed = new URL(url);
    host = parsed.hostname;
    port = parsed.port.length > 0 ? Number(parsed.port) : 6379;
  } catch {
    return false;
  }

  return new Promise((resolve) => {
    const socket = connect({ host, port });
    const done = (result: boolean): void => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(PING_TIMEOUT_MS);
    socket.once('connect', () => socket.write('PING\r\n'));
    socket.once('data', (data) => done(data.toString().startsWith('+')));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

/**
 * The configured URL when it answers, the first fallback that does, or the configured URL
 * unchanged when nothing answers (the app degrades gracefully; see cache.module.ts).
 */
export async function pickReachableRedisUrl(
  configured: string,
  fallbacks: readonly string[] = ['redis://127.0.0.1:6379'],
): Promise<string> {
  for (const candidate of [configured, ...fallbacks]) {
    if (await redisPings(candidate)) {
      return candidate;
    }
  }
  return configured;
}
