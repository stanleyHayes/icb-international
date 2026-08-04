import type {
  Beneficiary,
  CreateBeneficiaryRequest,
  CursorPage,
  UpdateBeneficiaryRequest,
} from '@icb/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotFoundError } from '../../../common/errors/index.js';
import { BeneficiariesController } from '../beneficiaries.controller.js';
import type { BeneficiariesService } from '../beneficiaries.service.js';

const CUSTOMER_ID = 'cust-1';
const BENEFICIARY_ID = 'ben-1';
const BENEFICIARY = { id: BENEFICIARY_ID, customerId: CUSTOMER_ID } as unknown as Beneficiary;
const PAGE: CursorPage<Beneficiary> = { items: [BENEFICIARY], nextCursor: null, hasMore: false };

function setup() {
  const beneficiaries = {
    list: vi.fn().mockResolvedValue(PAGE),
    create: vi.fn().mockResolvedValue(BENEFICIARY),
    get: vi.fn().mockResolvedValue(BENEFICIARY),
    update: vi.fn().mockResolvedValue(BENEFICIARY),
    remove: vi.fn().mockResolvedValue(undefined),
  };
  const controller = new BeneficiariesController(
    beneficiaries as unknown as BeneficiariesService,
  );
  return { controller, beneficiaries };
}

describe('BeneficiariesController', () => {
  let deps: ReturnType<typeof setup>;

  beforeEach(() => {
    deps = setup();
  });

  it('delegates list with the token customer and the validated query', async () => {
    const query = { status: 'active' as const, limit: 10 };

    const page = await deps.controller.list(CUSTOMER_ID, query);

    expect(deps.beneficiaries.list).toHaveBeenCalledWith(CUSTOMER_ID, query);
    expect(page).toBe(PAGE);
  });

  it('delegates create with the token customer and the parsed body', async () => {
    const body = {
      name: 'Mum',
      accountNumber: '00112233',
      sortCode: '04-06-75',
    } as unknown as CreateBeneficiaryRequest;

    const created = await deps.controller.create(CUSTOMER_ID, body);

    expect(deps.beneficiaries.create).toHaveBeenCalledWith(CUSTOMER_ID, body);
    expect(created).toBe(BENEFICIARY);
  });

  it('delegates detail with both the customer and the path id', async () => {
    const detail = await deps.controller.detail(CUSTOMER_ID, BENEFICIARY_ID);

    expect(deps.beneficiaries.get).toHaveBeenCalledWith(CUSTOMER_ID, BENEFICIARY_ID);
    expect(detail).toBe(BENEFICIARY);
  });

  it('delegates update with customer, id, and body', async () => {
    const body = { nickname: 'Grocery account' } as unknown as UpdateBeneficiaryRequest;

    await deps.controller.update(CUSTOMER_ID, BENEFICIARY_ID, body);

    expect(deps.beneficiaries.update).toHaveBeenCalledWith(CUSTOMER_ID, BENEFICIARY_ID, body);
  });

  it('delegates remove and resolves to nothing', async () => {
    const result = await deps.controller.remove(CUSTOMER_ID, BENEFICIARY_ID);

    expect(deps.beneficiaries.remove).toHaveBeenCalledWith(CUSTOMER_ID, BENEFICIARY_ID);
    expect(result).toBeUndefined();
  });

  it('propagates a NotFoundError from the service untouched', async () => {
    deps.beneficiaries.get.mockRejectedValue(new NotFoundError('Beneficiary', BENEFICIARY_ID));

    await expect(deps.controller.detail(CUSTOMER_ID, BENEFICIARY_ID)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
