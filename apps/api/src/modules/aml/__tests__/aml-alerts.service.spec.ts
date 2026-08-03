import type { Model } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConflictError, ValidationError } from '../../../common/errors/index.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { AmlAlertsService } from '../application/aml-alerts.service.js';
import { AmlReportsService } from '../application/reports.service.js';
import type { ScenarioHit } from '../domain/scenario.types.js';
import type { AmlAlertDoc } from '../infrastructure/aml-alert.schemas.js';

const NOW = new Date('2026-08-02T12:00:00.000Z');
const STAFF = { id: 'staff-1', label: 'officer@icb.example' };

/** A mongoose query whose chainable methods all return itself and whose `lean` resolves. */
function queryChain(result: unknown) {
  const chain = {
    sort: vi.fn(),
    skip: vi.fn(),
    limit: vi.fn(),
    lean: vi.fn().mockResolvedValue(result),
  };
  chain.sort.mockReturnValue(chain);
  chain.skip.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  return chain;
}

function alertDoc(overrides: Partial<AmlAlertDoc> = {}): AmlAlertDoc {
  return {
    _id: 'alert-1',
    reference: 'AML-AAAA1111',
    kind: 'structuring',
    customerId: 'cust-1',
    customerName: 'Amara Mensah',
    severity: 'high',
    status: 'open',
    matchDetail: '3 credits below the threshold',
    matchScore: null,
    relatedTransactionIds: ['t1', 't2', 't3'],
    aggregateMinorUnits: 2_650_000,
    currency: 'USD',
    narrative: 'Amara Mensah (high severity). Structuring suspected.',
    assignedTo: null,
    filedReport: null,
    trail: [],
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
    ...overrides,
  };
}

function hit(overrides: Partial<ScenarioHit> = {}): ScenarioHit {
  return {
    kind: 'structuring',
    matchDetail: '3 credits below the threshold',
    matchScore: null,
    relatedTransactionIds: ['t1', 't2', 't3'],
    aggregateMinorUnits: 2_650_000,
    currency: 'USD',
    ...overrides,
  };
}

interface ModelMock {
  findOne: ReturnType<typeof vi.fn>;
  findById: ReturnType<typeof vi.fn>;
  find: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  updateOne: ReturnType<typeof vi.fn>;
  countDocuments: ReturnType<typeof vi.fn>;
}

function modelMock(): ModelMock {
  return {
    findOne: vi.fn().mockReturnValue(queryChain(null)),
    findById: vi.fn(),
    find: vi.fn(),
    create: vi.fn((docs: unknown[]) => Promise.resolve(docs)),
    updateOne: vi.fn().mockResolvedValue({ acknowledged: true }),
    countDocuments: vi.fn().mockResolvedValue(0),
  };
}

describe('AmlAlertsService', () => {
  let model: ModelMock;
  let clock: ClockService;
  let service: AmlAlertsService;

  beforeEach(() => {
    model = modelMock();
    clock = new ClockService();
    clock.freeze(NOW);
    service = new AmlAlertsService(model as unknown as Model<AmlAlertDoc>, clock);
  });

  it('raises an alert with mapped severity, a narrative, and a trail entry', async () => {
    const alert = await service.raise({ customerId: 'cust-1', customerName: 'Amara Mensah', hit: hit() });

    const created = model.create.mock.calls[0]?.[0]?.[0] as Record<string, unknown>;
    expect(created['severity']).toBe('high');
    expect(created['status']).toBe('open');
    expect(created['narrative']).toContain('Amara Mensah');
    expect(created['trail']).toHaveLength(1);
    expect(created['createdAt']).toEqual(NOW);
    expect(alert?.reference).toMatch(/^AML-/);
  });

  it('escalates a sanctions hit to critical', async () => {
    await service.raise({
      customerId: 'cust-1',
      customerName: 'Viktor Rusanov',
      hit: hit({ kind: 'sanctions_match', matchScore: 0.97, aggregateMinorUnits: null, currency: null }),
    });

    const created = model.create.mock.calls[0]?.[0]?.[0] as Record<string, unknown>;
    expect(created['severity']).toBe('critical');
  });

  it('does not raise a duplicate while the same kind is still being worked', async () => {
    model.findOne.mockReturnValue(queryChain(alertDoc()));

    const alert = await service.raise({ customerId: 'cust-1', customerName: 'Amara Mensah', hit: hit() });

    expect(alert).toBeNull();
    expect(model.create).not.toHaveBeenCalled();
  });

  it('lists the queue with the actionable filter by default', async () => {
    model.find.mockReturnValue(queryChain([alertDoc()]));
    model.countDocuments.mockResolvedValue(1);

    const page = await service.list({ page: 1, limit: 20 });

    const filter = model.find.mock.calls[0]?.[0] as Record<string, { $in: string[] }>;
    expect(filter['status']?.$in).toEqual(['open', 'investigating', 'escalated']);
    expect(page.items).toHaveLength(1);
    expect(page.total).toBe(1);
    expect(page.items[0]?.aggregateAmount).toEqual({ minorUnits: 2_650_000, currency: 'USD', scale: 2 });
  });

  it('moves a case forward and records the move in the trail', async () => {
    model.findById.mockReturnValue(queryChain(alertDoc()));

    await service.update('alert-1', STAFF, { status: 'investigating' });

    const update = model.updateOne.mock.calls[0]?.[1] as {
      $set: Record<string, unknown>;
      $push: { trail: { $each: { action: string; detail: string }[] } };
    };
    expect(update.$set['status']).toBe('investigating');
    expect(update.$set['updatedAt']).toEqual(NOW);
    expect(update.$push.trail.$each[0]).toMatchObject({ action: 'status', detail: 'open → investigating' });
  });

  it('refuses an illegal status move and writes nothing', async () => {
    model.findById.mockReturnValue(queryChain(alertDoc({ status: 'closed' })));

    await expect(service.update('alert-1', STAFF, { status: 'open' })).rejects.toThrow(ValidationError);
    expect(model.updateOne).not.toHaveBeenCalled();
  });

  it('records assignment against the acting officer', async () => {
    model.findById.mockReturnValue(queryChain(alertDoc()));

    await service.update('alert-1', STAFF, { assignedTo: 'staff-9' });

    const update = model.updateOne.mock.calls[0]?.[1] as {
      $set: Record<string, unknown>;
      $push: { trail: { $each: { action: string; by: string }[] } };
    };
    expect(update.$set['assignedTo']).toBe('staff-9');
    expect(update.$push.trail.$each[0]).toMatchObject({ action: 'assign', by: STAFF.label });
  });
});

describe('AmlReportsService', () => {
  let model: ModelMock;
  let queue: AmlAlertsService;
  let reports: AmlReportsService;

  const NARRATIVE =
    'Reviewed the three credits against the customer profile; the amounts and timing are consistent with deliberate threshold avoidance.';

  beforeEach(() => {
    model = modelMock();
    const clock = new ClockService();
    clock.freeze(NOW);
    queue = new AmlAlertsService(model as unknown as Model<AmlAlertDoc>, clock);
    reports = new AmlReportsService(model as unknown as Model<AmlAlertDoc>, queue, clock);
  });

  it('files a SAR: stores the draft, pins the narrative, and closes the case', async () => {
    const filed = alertDoc({
      status: 'closed',
      narrative: NARRATIVE,
      filedReport: { kind: 'sar', reference: 'SAR-ZZZZ9999', filedAt: NOW, draft: 'draft' },
    });
    model.findById
      .mockReturnValueOnce(queryChain(alertDoc({ status: 'investigating' })))
      .mockReturnValue(queryChain(filed));

    const alert = await reports.fileReport('alert-1', STAFF, { kind: 'sar', narrative: NARRATIVE });

    const update = model.updateOne.mock.calls[0]?.[1] as {
      $set: { status: string; narrative: string; filedReport: { kind: string; reference: string; draft: string } };
      $push: { trail: { action: string } };
    };
    expect(update.$set.status).toBe('closed');
    expect(update.$set.narrative).toBe(NARRATIVE);
    expect(update.$set.filedReport.kind).toBe('sar');
    expect(update.$set.filedReport.reference).toMatch(/^SAR-/);
    expect(update.$set.filedReport.draft).toContain('SUSPICIOUS ACTIVITY REPORT');
    expect(update.$push.trail).toMatchObject({ action: 'file' });
    expect(alert.filedReport?.kind).toBe('sar');
  });

  it('replays rather than re-files when the same kind is filed twice', async () => {
    const filed = alertDoc({
      status: 'closed',
      filedReport: { kind: 'ctr', reference: 'CTR-AAAA1111', filedAt: NOW, draft: 'draft' },
    });
    model.findById.mockReturnValue(queryChain(filed));

    const alert = await reports.fileReport('alert-1', STAFF, { kind: 'ctr', narrative: NARRATIVE });

    expect(model.updateOne).not.toHaveBeenCalled();
    expect(alert.filedReport?.reference).toBe('CTR-AAAA1111');
  });

  it('refuses a second report of a different kind', async () => {
    const filed = alertDoc({
      status: 'closed',
      filedReport: { kind: 'sar', reference: 'SAR-AAAA1111', filedAt: NOW, draft: 'draft' },
    });
    model.findById.mockReturnValue(queryChain(filed));

    await expect(reports.fileReport('alert-1', STAFF, { kind: 'ctr', narrative: NARRATIVE })).rejects.toThrow(
      ConflictError,
    );
  });

  it('refuses to file from a dismissed case', async () => {
    model.findById.mockReturnValue(queryChain(alertDoc({ status: 'dismissed' })));

    await expect(reports.fileReport('alert-1', STAFF, { kind: 'sar', narrative: NARRATIVE })).rejects.toThrow(
      ConflictError,
    );
  });
});
