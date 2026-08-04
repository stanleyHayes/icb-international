import type { Model } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConflictError, NotFoundError } from '../../../common/errors/index.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import {
  RiskCasesService,
  type ResolveCaseRequest,
} from '../application/risk-cases.service.js';
import type { RiskAssessmentDoc, RiskCaseDoc } from '../infrastructure/risk-case.schemas.js';
import {
  ASSESSMENT_ID,
  CASE_ID,
  CUSTOMER_ID,
  NOW,
  assessmentDoc,
  caseDoc,
  chainQuery,
} from './fixtures.js';

function frozenClock(): ClockService {
  const clock = new ClockService();
  clock.freeze(NOW);
  return clock;
}

function setup(options: { caseRow?: RiskCaseDoc | null; assessment?: RiskAssessmentDoc | null } = {}) {
  const caseRow = options.caseRow === undefined ? caseDoc() : options.caseRow;
  const assessment = options.assessment === undefined ? assessmentDoc() : options.assessment;
  const cases = {
    create: vi.fn().mockImplementation(([doc]: [RiskCaseDoc]) => Promise.resolve([doc])),
    find: vi.fn().mockReturnValue(chainQuery(caseRow ? [caseRow] : [])),
    findById: vi.fn().mockReturnValue(chainQuery(caseRow)),
    updateOne: vi.fn().mockResolvedValue({}),
    countDocuments: vi.fn().mockResolvedValue(1),
  };
  const assessments = {
    find: vi.fn().mockReturnValue(chainQuery(assessment ? [assessment] : [])),
    findById: vi.fn().mockReturnValue(chainQuery(assessment)),
  };
  const service = new RiskCasesService(
    cases as unknown as Model<RiskCaseDoc>,
    assessments as unknown as Model<RiskAssessmentDoc>,
    frozenClock(),
  );
  return { service, cases, assessments };
}

describe('RiskCasesService.raise', () => {
  it('opens a case carrying the assessment severity', async () => {
    const { service, cases } = setup();
    const raised = await service.raise(assessmentDoc(), 'Ama Mensah');

    expect(cases.create).toHaveBeenCalledWith([
      expect.objectContaining({
        customerId: CUSTOMER_ID,
        assessmentId: ASSESSMENT_ID,
        status: 'open',
        resolution: null,
      }),
    ]);
    expect(raised.id).toEqual(expect.any(String));
  });

  it('fails the call when the insert returns nothing', async () => {
    const { service, cases } = setup();
    cases.create.mockResolvedValue([]);
    await expect(service.raise(assessmentDoc(), 'Ama Mensah')).rejects.toBeInstanceOf(
      ConflictError,
    );
  });
});

describe('RiskCasesService.list', () => {
  let deps: ReturnType<typeof setup>;

  beforeEach(() => {
    deps = setup();
  });

  it('defaults to the actionable statuses and pages by offset', async () => {
    const page = await deps.service.list({ page: 2, limit: 10 });

    expect(deps.cases.find).toHaveBeenCalledWith({
      status: { $in: ['open', 'investigating', 'escalated'] },
    });
    const query = deps.cases.find.mock.results[0]?.value as ReturnType<typeof chainQuery>;
    expect(query.skip).toHaveBeenCalledWith(10);
    expect(page.total).toBe(1);
  });

  it('applies status, severity, decision and assignee filters', async () => {
    await deps.service.list({
      page: 1,
      limit: 5,
      status: ['open'],
      severity: ['high'],
      decision: ['review'],
      assignedTo: 'staff-1',
    });

    expect(deps.cases.find).toHaveBeenCalledWith({
      status: { $in: ['open'] },
      severity: { $in: ['high'] },
      decision: { $in: ['review'] },
      assignedTo: 'staff-1',
    });
  });

  it('drops rows whose assessment no longer exists', async () => {
    const { service, assessments } = setup();
    assessments.find.mockReturnValue(chainQuery([]));

    const page = await service.list({ page: 1, limit: 10 });
    expect(page.items).toHaveLength(0);
    expect(page.total).toBe(1);
  });
});

describe('RiskCasesService.byId', () => {
  it('throws NotFoundError for a missing case', async () => {
    const { service } = setup({ caseRow: null });
    await expect(service.byId(CASE_ID)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('throws NotFoundError when the assessment behind the case is gone', async () => {
    const { service } = setup({ assessment: null });
    await expect(service.byId(CASE_ID)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('RiskCasesService.claim', () => {
  it('assigns the caller and moves the case to investigating', async () => {
    const { service, cases } = setup();
    await service.claim(CASE_ID, 'staff-1');

    expect(cases.updateOne).toHaveBeenCalledWith(
      { _id: CASE_ID },
      { $set: { assignedTo: 'staff-1', status: 'investigating', updatedAt: NOW } },
    );
  });

  it('refuses to claim an already-resolved case', async () => {
    const resolved = caseDoc({
      resolution: { action: 'released', note: 'ok', by: 'Analyst', at: NOW },
    });
    const { service } = setup({ caseRow: resolved });
    await expect(service.claim(CASE_ID, 'staff-1')).rejects.toBeInstanceOf(ConflictError);
  });
});

describe('RiskCasesService.resolve', () => {
  function resolveRequest(action: ResolveCaseRequest['action']): ResolveCaseRequest {
    return { action, note: 'Done' };
  }

  it('closes a released case and records who acted', async () => {
    const { service, cases } = setup();
    await service.resolve(CASE_ID, { id: 'staff-1', label: 'Analyst' }, resolveRequest('released'));

    expect(cases.updateOne).toHaveBeenCalledWith(
      { _id: CASE_ID },
      {
        $set: expect.objectContaining({
          status: 'closed',
          assignedTo: 'staff-1',
          resolution: { action: 'released', note: 'Done', by: 'Analyst', at: NOW },
        }),
      },
    );
  });

  it('keeps the existing assignee when one is set', async () => {
    const claimed = caseDoc({ assignedTo: 'staff-9' });
    const { service, cases } = setup({ caseRow: claimed });
    await service.resolve(CASE_ID, { id: 'staff-1', label: 'Analyst' }, resolveRequest('no_action'));

    expect(cases.updateOne).toHaveBeenCalledWith(
      { _id: CASE_ID },
      { $set: expect.objectContaining({ status: 'dismissed', assignedTo: 'staff-9' }) },
    );
  });

  it('escalates rather than closes on escalated_to_aml', async () => {
    const { service, cases } = setup();
    await service.resolve(
      CASE_ID,
      { id: 'staff-1', label: 'Analyst' },
      resolveRequest('escalated_to_aml'),
    );
    expect(cases.updateOne).toHaveBeenCalledWith(
      { _id: CASE_ID },
      { $set: expect.objectContaining({ status: 'escalated' }) },
    );
  });

  it('refuses to resolve a case that already has a resolution', async () => {
    const resolved = caseDoc({
      resolution: { action: 'blocked', note: 'done', by: 'Analyst', at: NOW },
    });
    const { service } = setup({ caseRow: resolved });
    await expect(
      service.resolve(CASE_ID, { id: 'staff-1', label: 'Analyst' }, resolveRequest('released')),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});
