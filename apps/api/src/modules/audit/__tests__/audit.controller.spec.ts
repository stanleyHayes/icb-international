import { describe, expect, it, vi } from 'vitest';

import { NDJSON_CONTENT_TYPE } from '../audit.constants.js';
import { AuditController } from '../audit.controller.js';
import type { AuditService } from '../audit.service.js';
import type { AuditQuery } from '../domain/audit-event.js';

function setup() {
  const audit = {
    search: vi.fn().mockResolvedValue({ items: [], offset: 0, limit: 25, total: 0 }),
    verifyIntegrity: vi.fn().mockResolvedValue({ ok: true, checked: 42 }),
    exportEvents: vi.fn().mockResolvedValue('{"id":"evt-1"}\n'),
  };
  const controller = new AuditController(audit as unknown as AuditService);
  return { controller, audit };
}

describe('AuditController', () => {
  it('delegates the event search to the audit service', async () => {
    const { controller, audit } = setup();
    const query = { actorId: 'staff-1' } as unknown as AuditQuery;

    const page = await controller.search(query);

    expect(audit.search).toHaveBeenCalledWith(query);
    expect(page.total).toBe(0);
  });

  it('reports the chain integrity verdict', async () => {
    const { controller, audit } = setup();

    await expect(controller.integrity()).resolves.toEqual({ ok: true, checked: 42 });
    expect(audit.verifyIntegrity).toHaveBeenCalledOnce();
  });

  it('streams the export as NDJSON text', async () => {
    const { controller, audit } = setup();
    const query = {} as AuditQuery;

    const body = await controller.exportEvents(query);

    expect(audit.exportEvents).toHaveBeenCalledWith(query);
    expect(body).toBe('{"id":"evt-1"}\n');
  });

  it('serves NDJSON on the export route', () => {
    expect(NDJSON_CONTENT_TYPE).toBe('application/x-ndjson');
  });
});
