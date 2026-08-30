import type { Session } from '@icb/contracts';
import type { FlattenMaps } from 'mongoose';

import type { SessionDoc } from '../../customers/infrastructure/customer.schemas.js';
import { parseUserAgent } from '../domain/device-label.js';

/** `createdAt` is added by schema timestamps, so it exists at runtime but not on the class. */
export type SessionRow = FlattenMaps<SessionDoc> & { readonly createdAt?: Date };

interface StoredDevice {
  readonly label?: unknown;
  readonly userAgent?: unknown;
}

/** Maps a session row to the contract shape, deriving browser/OS from the stored user agent. */
export function toSession(row: SessionRow, currentSessionId: string): Session {
  const stored = row.device as StoredDevice;
  const parsed = parseUserAgent(typeof stored.userAgent === 'string' ? stored.userAgent : '');

  return {
    id: row._id,
    device: {
      label: typeof stored.label === 'string' ? stored.label : parsed.label,
      browser: parsed.browser,
      os: parsed.os,
    },
    ipAddress: row.ipAddress,
    location: row.location,
    createdAt: (row.createdAt ?? row.lastSeenAt).toISOString(),
    lastSeenAt: row.lastSeenAt.toISOString(),
    current: row._id === currentSessionId,
  };
}
