import type { TransferTemplate } from '@icb/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TransferTemplatesService } from '../application/transfer-templates.service.js';
import { TransferTemplatesController } from '../transfer-templates.controller.js';

const CUSTOMER_ID = 'cust-1';
const TEMPLATE = { id: 'tpl-1' } as unknown as TransferTemplate;

describe('TransferTemplatesController', () => {
  let templates: Record<'list' | 'create' | 'remove', ReturnType<typeof vi.fn>>;
  let controller: TransferTemplatesController;

  beforeEach(() => {
    templates = {
      list: vi.fn().mockResolvedValue([TEMPLATE]),
      create: vi.fn().mockResolvedValue(TEMPLATE),
      remove: vi.fn().mockResolvedValue(undefined),
    };
    controller = new TransferTemplatesController(templates as unknown as TransferTemplatesService);
  });

  it('lists the customer templates as a bare array', async () => {
    const result = await controller.list(CUSTOMER_ID);

    expect(templates.list).toHaveBeenCalledWith(CUSTOMER_ID);
    expect(result).toEqual([TEMPLATE]);
  });

  it('creates a template for the token customer', async () => {
    const body = { name: 'Rent', amount: { minorUnits: 150_000 } };

    const result = await controller.create(CUSTOMER_ID, body as never);

    expect(templates.create).toHaveBeenCalledWith(CUSTOMER_ID, body);
    expect(result).toBe(TEMPLATE);
  });

  it('removes a template and answers with no content', async () => {
    const result = await controller.remove(CUSTOMER_ID, 'tpl-1');

    expect(templates.remove).toHaveBeenCalledWith(CUSTOMER_ID, 'tpl-1');
    expect(result).toBeUndefined();
  });
});
