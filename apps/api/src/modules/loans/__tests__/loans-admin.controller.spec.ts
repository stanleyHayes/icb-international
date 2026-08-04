import type { Loan, LoanApplication } from '@icb/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AccessTokenClaims } from '../../auth/application/token.service.js';
import type { LoanApplicationsService } from '../loan-applications.service.js';
import type { LoanDisbursementService } from '../loan-disbursement.service.js';
import { LoansAdminController } from '../loans-admin.controller.js';

const LOAN_ID = 'loan-1';
const APPLICATION_ID = 'app-1';

const LOAN = { id: LOAN_ID } as unknown as Loan;
const APPLICATION = { id: APPLICATION_ID } as unknown as LoanApplication;

const UNDERWRITER: AccessTokenClaims = {
  sub: 'staff-1',
  customerId: null,
  email: 'underwriter@icb.example',
  roles: ['underwriter'],
  sessionId: 'sess-1',
};

describe('LoansAdminController', () => {
  let applications: { queue: ReturnType<typeof vi.fn>; decideByStaff: ReturnType<typeof vi.fn> };
  let disbursement: { disburse: ReturnType<typeof vi.fn> };
  let controller: LoansAdminController;

  beforeEach(() => {
    applications = {
      queue: vi.fn().mockResolvedValue([APPLICATION]),
      decideByStaff: vi.fn().mockResolvedValue(APPLICATION),
    };
    disbursement = { disburse: vi.fn().mockResolvedValue(LOAN) };

    controller = new LoansAdminController(
      applications as unknown as LoanApplicationsService,
      disbursement as unknown as LoanDisbursementService,
    );
  });

  it('lists the underwriting queue inside an items envelope', async () => {
    const result = await controller.queue();

    expect(applications.queue).toHaveBeenCalledOnce();
    expect(result).toEqual({ items: [APPLICATION] });
  });

  it('records a staff decision under the underwriter email', async () => {
    const body = { decision: 'approve', reason: 'Meets policy' };

    const result = await controller.decide(UNDERWRITER, APPLICATION_ID, body as never);

    expect(applications.decideByStaff).toHaveBeenCalledWith(
      APPLICATION_ID,
      'underwriter@icb.example',
      body,
    );
    expect(result).toBe(APPLICATION);
  });

  it('disburses with a staff posting actor built from the token claims', async () => {
    const result = await controller.disburse(UNDERWRITER, LOAN_ID);

    expect(disbursement.disburse).toHaveBeenCalledWith(LOAN_ID, {
      kind: 'staff',
      id: 'staff-1',
      label: 'underwriter@icb.example',
    });
    expect(result).toBe(LOAN);
  });
});
