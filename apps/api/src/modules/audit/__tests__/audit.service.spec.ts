import { describe, expect, it, vi } from 'vitest';

import { REDACTED_VALUE } from '../../../common/interceptors/redaction.constants.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { AuditService } from '../audit.service.js';
import type { RecordAuditInput } from '../domain/audit-event.js';
import { computeEventHash } from '../domain/hash-chain.js';
import type { AuditEventRepository } from '../infrastructure/audit-event.repository.js';
import type { AuditEventDoc } from '../infrastructure/audit-event.schemas.js';

const NOW = new Date('2026-08-02T12:00:00.000Z');
const ACTOR = { type: 'staff', id: '01ARZ3NDEKTSV4RRFFQ69G5FAV', label: 'ops@icb.example' } as const;

function input(overrides: Partial<RecordAuditInput> = {}): RecordAuditInput {
  return {
    actor: ACTOR,
    action: 'account.freeze',
    subject: { type: 'accounts', id: '01ARZ3NDEKTSV4RRFFQ69G5FB0' },
    correlationId: 'corr-1',
    ...overrides,
  };
}

function setup() {
  const rows: AuditEventDoc[] = [];
  const clock = new ClockService();
  clock.freeze(NOW);
  const repository = {
    last: (): Promise<AuditEventDoc | null> => Promise.resolve(rows.at(-1) ?? null),
    insert: vi.fn((event: AuditEventDoc): Promise<void> => {
      rows.push(event);
      return Promise.resolve();
    }),
    page: () =>
      Promise.resolve({
        items: [...rows].sort((left, right) => right.sequence - left.sequence),
        total: rows.length,
      }),
    walkAll: () => iterate(() => [...rows].sort((left, right) => left.sequence - right.sequence)),
    walkQuery: () => iterate(() => rows),
  };
  const service = new AuditService(
    repository as unknown as AuditEventRepository,
    clock,
  );
  return { rows, repository, service };
}

async function* iterate(read: () => readonly AuditEventDoc[]): AsyncGenerator<AuditEventDoc> {
  for (const row of read()) {
    await Promise.resolve();
    yield row;
  }
}

describe('record', () => {
  it('appends the genesis event at sequence 0 with no previous hash', async () => {
    const { rows, service } = setup();
    const event = await service.record(input());

    expect(event.sequence).toBe(0);
    expect(event.previousHash).toBeNull();
    expect(event.hash).toBe(computeEventHash(null, rows[0] as AuditEventDoc));
    expect(event.at).toBe(NOW.toISOString());
  });

  it('chains each event onto its predecessor', async () => {
    const { rows, service } = setup();
    const first = await service.record(input());
    const second = await service.record(input({ action: 'account.unfreeze' }));

    expect(second.sequence).toBe(1);
    expect(second.previousHash).toBe(first.hash);
    expect(rows[1]?.hash).toBe(computeEventHash(first.hash, rows[1] as AuditEventDoc));
  });

  it('masks PII in before/after and in the derived change rows', async () => {
    const { rows, service } = setup();
    await service.record(
      input({
        before: { pan: '4242424242424242', status: 'active' },
        after: { pan: '4242424242424242', status: 'frozen' },
      }),
    );

    const stored = rows[0] as AuditEventDoc;
    expect(stored.before?.['pan']).toBe(REDACTED_VALUE);
    expect(stored.after?.['pan']).toBe(REDACTED_VALUE);
    // Both sides redact to the same marker, so the PAN leaves no change row either.
    expect(stored.changes.some((change) => change.field === 'pan')).toBe(false);
    expect(stored.changes).toContainEqual({ field: 'status', before: 'active', after: 'frozen' });
    expect(JSON.stringify(stored)).not.toContain('4242');
  });

  it('defaults the summary to the action and the correlation id to system', async () => {
    const { service } = setup();
    const event = await service.record({
      actor: ACTOR,
      action: 'account.freeze',
      subject: { type: 'accounts', id: '01ARZ3NDEKTSV4RRFFQ69G5FB0' },
    });
    expect(event.summary).toBe('account.freeze');
    expect(event.correlationId).toBe('system');
    expect(event.ipAddress).toBeNull();
  });

  it('retries the sequence race when a concurrent append wins', async () => {
    const { rows, repository, service } = setup();
    repository.insert.mockImplementationOnce((event: AuditEventDoc) => {
      rows.push({ ...event, _id: 'concurrent-winner' });
      return Promise.reject(Object.assign(new Error('duplicate key'), { code: 11000 }));
    });

    const event = await service.record(input());

    expect(event.sequence).toBe(1);
    expect(event.previousHash).toBe(rows[0]?.hash ?? null);
    expect(rows).toHaveLength(2);
  });

  it('propagates non-duplicate persistence failures', async () => {
    const { repository, service } = setup();
    repository.insert.mockRejectedValueOnce(new Error('connection lost'));
    await expect(service.record(input())).rejects.toThrow('connection lost');
  });
});

describe('search', () => {
  it('maps stored rows to the wire contract in an offset page', async () => {
    const { service } = setup();
    await service.record(input());
    const page = await service.search({ page: 1, limit: 20 });

    expect(page.total).toBe(1);
    expect(page.items[0]).toMatchObject({
      sequence: 0,
      actorType: 'staff',
      actorLabel: 'ops@icb.example',
      action: 'account.freeze',
      subjectType: 'accounts',
      at: NOW.toISOString(),
    });
  });
});

describe('verifyIntegrity', () => {
  it('verifies a chain it just wrote', async () => {
    const { service } = setup();
    await service.record(input());
    await service.record(input({ action: 'account.unfreeze' }));

    const report = await service.verifyIntegrity();

    expect(report).toEqual({
      verified: true,
      checkedEvents: 2,
      firstBrokenSequence: null,
      checkedAt: NOW.toISOString(),
    });
  });

  it('reports the first row whose contents no longer match its hash', async () => {
    const { rows, service } = setup();
    await service.record(input());
    await service.record(input({ action: 'account.unfreeze' }));
    (rows[0] as AuditEventDoc).summary = 'forged after the fact';

    const report = await service.verifyIntegrity();

    expect(report.verified).toBe(false);
    expect(report.firstBrokenSequence).toBe(0);
    expect(report.checkedEvents).toBe(2);
  });

  it('reports a broken link when a previousHash pointer is rewritten', async () => {
    const { rows, service } = setup();
    await service.record(input());
    await service.record(input({ action: 'account.unfreeze' }));
    (rows[1] as AuditEventDoc).previousHash = 'f'.repeat(64);

    const report = await service.verifyIntegrity();

    expect(report.verified).toBe(false);
    expect(report.firstBrokenSequence).toBe(1);
  });

  it('verifies an empty trail', async () => {
    const { service } = setup();
    const report = await service.verifyIntegrity();
    expect(report.verified).toBe(true);
    expect(report.checkedEvents).toBe(0);
  });
});

describe('exportEvents', () => {
  it('streams one contract-shaped JSON event per line', async () => {
    const { service } = setup();
    await service.record(input());
    await service.record(input({ action: 'account.unfreeze' }));

    const ndjson = await service.exportEvents({ page: 1, limit: 20 });
    const lines = ndjson.trimEnd().split('\n');

    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0] as string)).toMatchObject({ sequence: 0, action: 'account.freeze' });
    expect(JSON.parse(lines[1] as string)).toMatchObject({ sequence: 1 });
    expect(ndjson.endsWith('\n')).toBe(true);
  });

  it('returns an empty body when nothing matches', async () => {
    const { service } = setup();
    await expect(service.exportEvents({ page: 1, limit: 20 })).resolves.toBe('');
  });
});
