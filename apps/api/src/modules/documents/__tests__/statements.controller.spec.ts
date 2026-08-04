import type { DownloadLink, Statement } from '@icb/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { StatementsController } from '../statements.controller.js';
import { type StatementsService } from '../statements.service.js';

const STATEMENT = { id: 'stmt-1', accountId: 'acct-1' } as unknown as Statement;
const LINK: DownloadLink = {
  url: 'https://files.example.com/signed/stmt-1',
  expiresAt: '2026-08-04T10:05:00.000Z',
  filename: 'statement-2026-07.pdf',
};

describe('StatementsController', () => {
  let statements: {
    listForCustomer: ReturnType<typeof vi.fn>;
    generate: ReturnType<typeof vi.fn>;
    downloadLink: ReturnType<typeof vi.fn>;
  };
  let controller: StatementsController;

  beforeEach(() => {
    statements = {
      listForCustomer: vi.fn().mockResolvedValue([STATEMENT]),
      generate: vi.fn().mockResolvedValue(STATEMENT),
      downloadLink: vi.fn().mockResolvedValue(LINK),
    };
    controller = new StatementsController(statements as unknown as StatementsService);
  });

  it('lists the caller statements wrapped in an items envelope', async () => {
    const result = await controller.list('cust-1');

    expect(statements.listForCustomer).toHaveBeenCalledWith('cust-1');
    expect(result).toEqual({ items: [STATEMENT] });
  });

  it('generates a statement with the token customer, not a body customer', async () => {
    const body = { accountId: 'acct-1', from: '2026-07-01', to: '2026-07-31' };

    const result = await controller.generate('cust-1', body);

    expect(statements.generate).toHaveBeenCalledWith('cust-1', body);
    expect(result).toBe(STATEMENT);
  });

  it('mints a fresh signed download link on each call', async () => {
    const result = await controller.download('cust-1', 'stmt-1');

    expect(statements.downloadLink).toHaveBeenCalledWith('cust-1', 'stmt-1');
    expect(result).toBe(LINK);
  });
});
