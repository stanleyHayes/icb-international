import type { Loan, LoanApplication, LoanDetail } from '@icb/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { LoanApplicationsService } from '../loan-applications.service.js';
import type { LoanDocumentsService } from '../loan-documents.service.js';
import type { LoanRepaymentService } from '../loan-repayment.service.js';
import { LoansController } from '../loans.controller.js';
import type { LoansService } from '../loans.service.js';

const CUSTOMER_ID = 'cust-1';
const LOAN_ID = 'loan-1';
const APPLICATION_ID = 'app-1';

const LOAN = { id: LOAN_ID } as unknown as Loan;
const DETAIL = { id: LOAN_ID } as unknown as LoanDetail;
const APPLICATION = { id: APPLICATION_ID } as unknown as LoanApplication;

describe('LoansController', () => {
  let loans: Record<'listForCustomer' | 'products' | 'quote' | 'getForCustomer', ReturnType<typeof vi.fn>>;
  let applications: Record<
    'listForCustomer' | 'create' | 'getForCustomer' | 'accept',
    ReturnType<typeof vi.fn>
  >;
  let repayments: { payoffQuote: ReturnType<typeof vi.fn>; repay: ReturnType<typeof vi.fn> };
  let documents: { mintUploadSignature: ReturnType<typeof vi.fn>; attach: ReturnType<typeof vi.fn> };
  let controller: LoansController;

  beforeEach(() => {
    loans = {
      listForCustomer: vi.fn().mockResolvedValue([LOAN]),
      products: vi.fn().mockReturnValue([{ id: 'personal' }]),
      quote: vi.fn().mockResolvedValue({ monthlyPayment: { minorUnits: 10_000 } }),
      getForCustomer: vi.fn().mockResolvedValue(DETAIL),
    };
    applications = {
      listForCustomer: vi.fn().mockResolvedValue([APPLICATION]),
      create: vi.fn().mockResolvedValue(APPLICATION),
      getForCustomer: vi.fn().mockResolvedValue(APPLICATION),
      accept: vi.fn().mockResolvedValue(APPLICATION),
    };
    repayments = {
      payoffQuote: vi.fn().mockResolvedValue({ total: { minorUnits: 500_000 } }),
      repay: vi.fn().mockResolvedValue(DETAIL),
    };
    documents = {
      mintUploadSignature: vi.fn().mockResolvedValue({ url: 'https://storage.example/upload' }),
      attach: vi.fn().mockResolvedValue(APPLICATION),
    };

    controller = new LoansController(
      loans as unknown as LoansService,
      applications as unknown as LoanApplicationsService,
      repayments as unknown as LoanRepaymentService,
      documents as unknown as LoanDocumentsService,
    );
  });

  it('lists the customer loans inside an items envelope', async () => {
    const result = await controller.list(CUSTOMER_ID);

    expect(loans.listForCustomer).toHaveBeenCalledWith(CUSTOMER_ID);
    expect(result).toEqual({ items: [LOAN] });
  });

  it('returns the static product catalogue synchronously', () => {
    const result = controller.products();

    expect(loans.products).toHaveBeenCalledOnce();
    expect(result).toEqual({ items: [{ id: 'personal' }] });
  });

  it('quotes a loan for the token customer', async () => {
    const body = { productId: 'personal', principal: { minorUnits: 1_000_000 } };

    const result = await controller.quote(CUSTOMER_ID, body as never);

    expect(loans.quote).toHaveBeenCalledWith(CUSTOMER_ID, body);
    expect(result).toEqual({ monthlyPayment: { minorUnits: 10_000 } });
  });

  it('lists applications inside an items envelope', async () => {
    const result = await controller.listApplications(CUSTOMER_ID);

    expect(applications.listForCustomer).toHaveBeenCalledWith(CUSTOMER_ID);
    expect(result).toEqual({ items: [APPLICATION] });
  });

  it('creates an application for the token customer', async () => {
    const body = { productId: 'personal', principal: { minorUnits: 1_000_000 } };

    const result = await controller.apply(CUSTOMER_ID, body as never);

    expect(applications.create).toHaveBeenCalledWith(CUSTOMER_ID, body);
    expect(result).toBe(APPLICATION);
  });

  it('reads an application scoped by the token customer', async () => {
    const result = await controller.application(CUSTOMER_ID, APPLICATION_ID);

    expect(applications.getForCustomer).toHaveBeenCalledWith(APPLICATION_ID, CUSTOMER_ID);
    expect(result).toBe(APPLICATION);
  });

  it('accepts an application', async () => {
    const result = await controller.accept(CUSTOMER_ID, APPLICATION_ID);

    expect(applications.accept).toHaveBeenCalledWith(APPLICATION_ID, CUSTOMER_ID);
    expect(result).toBe(APPLICATION);
  });

  it('mints an upload signature for a supporting document', async () => {
    const body = { filename: 'payslip.pdf', contentType: 'application/pdf' };

    const result = await controller.documentUploadSignature(CUSTOMER_ID, APPLICATION_ID, body as never);

    expect(documents.mintUploadSignature).toHaveBeenCalledWith(APPLICATION_ID, CUSTOMER_ID, body);
    expect(result).toEqual({ url: 'https://storage.example/upload' });
  });

  it('attaches an uploaded document to the application', async () => {
    const body = { documentId: 'doc-1', kind: 'payslip' };

    const result = await controller.attachDocument(CUSTOMER_ID, APPLICATION_ID, body as never);

    expect(documents.attach).toHaveBeenCalledWith(APPLICATION_ID, CUSTOMER_ID, body);
    expect(result).toBe(APPLICATION);
  });

  it('reads a loan detail scoped by the token customer', async () => {
    const result = await controller.detail(CUSTOMER_ID, LOAN_ID);

    expect(loans.getForCustomer).toHaveBeenCalledWith(LOAN_ID, CUSTOMER_ID);
    expect(result).toBe(DETAIL);
  });

  it('quotes the payoff amount', async () => {
    const result = await controller.payoffQuote(CUSTOMER_ID, LOAN_ID);

    expect(repayments.payoffQuote).toHaveBeenCalledWith(LOAN_ID, CUSTOMER_ID);
    expect(result).toEqual({ total: { minorUnits: 500_000 } });
  });

  it('makes a repayment and returns the refreshed detail', async () => {
    const body = { amount: { minorUnits: 10_000, currency: 'USD', scale: 2 } };

    const result = await controller.repay(CUSTOMER_ID, LOAN_ID, body as never);

    expect(repayments.repay).toHaveBeenCalledWith(LOAN_ID, CUSTOMER_ID, body);
    expect(result).toBe(DETAIL);
  });
});
