import { BUSINESS_CURRENT_PAGE } from './business-current';
import { BUSINESS_LOANS_PAGE } from './business-loans';
import { BUSINESS_MERCHANT_PAGE } from './business-merchant-services';
import { BUSINESS_PAYROLL_PAGE } from './business-payroll';
import { BUSINESS_TRADE_PAGE } from './business-trade-finance';
import { PERSONAL_CARDS_PAGE } from './personal-cards';
import { PERSONAL_CURRENT_PAGE } from './personal-current';
import { PERSONAL_DEPOSITS_PAGE } from './personal-deposits';
import { PERSONAL_LOANS_PAGE } from './personal-loans';
import { PERSONAL_MORTGAGES_PAGE } from './personal-mortgages';
import { PERSONAL_SAVINGS_PAGE } from './personal-savings';
import type { ProductPageCopy } from './types';
import { WEALTH_FX_PAGE } from './wealth-fx';
import { WEALTH_INVESTMENTS_PAGE } from './wealth-investments';
import { WEALTH_PRIVATE_PAGE } from './wealth-private-banking';

export const PERSONAL_PAGES: readonly ProductPageCopy[] = [
  PERSONAL_CURRENT_PAGE,
  PERSONAL_SAVINGS_PAGE,
  PERSONAL_DEPOSITS_PAGE,
  PERSONAL_CARDS_PAGE,
  PERSONAL_LOANS_PAGE,
  PERSONAL_MORTGAGES_PAGE,
] as const;

export const BUSINESS_PAGES: readonly ProductPageCopy[] = [
  BUSINESS_CURRENT_PAGE,
  BUSINESS_MERCHANT_PAGE,
  BUSINESS_TRADE_PAGE,
  BUSINESS_PAYROLL_PAGE,
  BUSINESS_LOANS_PAGE,
] as const;

export const WEALTH_PAGES: readonly ProductPageCopy[] = [
  WEALTH_INVESTMENTS_PAGE,
  WEALTH_FX_PAGE,
  WEALTH_PRIVATE_PAGE,
] as const;
