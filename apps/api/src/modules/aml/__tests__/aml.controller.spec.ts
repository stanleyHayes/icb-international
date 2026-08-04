import { describe, expect, it, vi } from 'vitest';

import { NotFoundError } from '../../../common/errors/index.js';
import type { AccessTokenClaims } from '../../auth/application/token.service.js';
import { AmlController } from '../aml.controller.js';
import type {
  AmlAlertsService,
  AmlAlertQuery,
  UpdateAmlAlertRequest,
} from '../application/aml-alerts.service.js';
import type { AmlReportsService, FileReportRequest } from '../application/reports.service.js';

const OFFICER: AccessTokenClaims = {
  sub: 'staff-7',
  customerId: null,
  email: 'aml@icb.example',
  roles: ['aml_officer'],
  sessionId: 'sess-7',
};

function setup() {
  const alerts = {
    list: vi.fn().mockResolvedValue({ items: [], offset: 0, limit: 25, total: 0 }),
    byId: vi.fn().mockResolvedValue({ id: 'alert-1' }),
    update: vi.fn().mockResolvedValue({ id: 'alert-1', status: 'assigned' }),
  };
  const reports = {
    fileReport: vi.fn().mockResolvedValue({ id: 'alert-1', reports: ['sar-1'] }),
  };
  const controller = new AmlController(
    alerts as unknown as AmlAlertsService,
    reports as unknown as AmlReportsService,
  );
  return { controller, alerts, reports };
}

describe('AmlController', () => {
  it('delegates the alert queue query', async () => {
    const { controller, alerts } = setup();
    const query = { status: 'open' } as unknown as AmlAlertQuery;

    const page = await controller.listAlerts(query);

    expect(alerts.list).toHaveBeenCalledWith(query);
    expect(page.items).toEqual([]);
  });

  it('looks up a single alert by id', async () => {
    const { controller, alerts } = setup();

    const alert = await controller.getAlert('alert-1');

    expect(alerts.byId).toHaveBeenCalledWith('alert-1');
    expect(alert.id).toBe('alert-1');
  });

  it('propagates a not-found for an unknown alert', async () => {
    const { controller, alerts } = setup();
    alerts.byId.mockRejectedValue(new NotFoundError('AmlAlert', 'alert-9'));

    await expect(controller.getAlert('alert-9')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('attributes the case update to the token subject and email', async () => {
    const { controller, alerts } = setup();
    const body = { status: 'escalated' } as unknown as UpdateAmlAlertRequest;

    await controller.updateAlert(OFFICER, 'alert-1', body);

    expect(alerts.update).toHaveBeenCalledWith(
      'alert-1',
      { id: 'staff-7', label: 'aml@icb.example' },
      body,
    );
  });

  it('files a report under the acting officer, never a body value', async () => {
    const { controller, reports } = setup();
    const body = { kind: 'sar' } as unknown as FileReportRequest;

    const alert = await controller.fileReport(OFFICER, 'alert-1', body);

    expect(reports.fileReport).toHaveBeenCalledWith(
      'alert-1',
      { id: 'staff-7', label: 'aml@icb.example' },
      body,
    );
    expect(alert).toEqual({ id: 'alert-1', reports: ['sar-1'] });
  });
});
