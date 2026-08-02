import { z } from 'zod';

import {
  fxQuoteRequestSchema,
  fxQuoteSchema,
  fxRateSchema,
  productSchema,
  rateTableSchema,
} from '../../../src/index.js';
import { STATUS, TAG } from '../constants.js';
import { defineOperations, success } from '../spec.js';

export const productsOperations = defineOperations([
  {
    method: 'get', path: '/products', tag: TAG.products, operationId: 'listProducts',
    summary: 'The product catalogue', auth: false,
    response: success(STATUS.ok, 'All active products.', z.array(productSchema)),
  },
  {
    method: 'get', path: '/products/{productCode}', tag: TAG.products, operationId: 'getProduct',
    summary: 'One product with fees and eligibility', auth: false,
    pathParams: { productCode: z.string().min(1).max(40) },
    response: success(STATUS.ok, 'The product.', productSchema),
    errors: [{ status: STATUS.notFound }],
  },
  {
    method: 'get', path: '/products/rates', tag: TAG.products, operationId: 'getRateTable',
    summary: 'The published rate table for the marketing site', auth: false,
    response: success(STATUS.ok, 'Current savings, deposit, and loan rates.', rateTableSchema),
  },
  {
    method: 'get', path: '/fx/rates', tag: TAG.products, operationId: 'listFxRates',
    summary: 'Current FX rates for all quoted pairs', auth: false,
    response: success(STATUS.ok, 'Rates with spread and 24h change.', z.array(fxRateSchema)),
  },
  {
    method: 'post', path: '/fx/quotes', tag: TAG.products, operationId: 'quoteFx',
    summary: 'An indicative FX conversion quote with countdown', auth: false,
    request: fxQuoteRequestSchema,
    response: success(STATUS.created, 'The quote.', fxQuoteSchema),
    errors: [{ status: STATUS.unprocessable }],
  },
]);
