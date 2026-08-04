import { z } from 'zod';
import {
  fxQuoteRequestSchema,
  fxQuoteSchema,
  fxRateSchema,
  productSchema,
  rateTableSchema,
} from '@icb/contracts';

import { get, post, type Requester } from '../endpoint.js';
import { type RequestOptions } from '../http.js';

export const productsEndpoints = {
  list: get('/products', z.array(productSchema), { auth: false }),
  rates: get('/products/rates', rateTableSchema, { auth: false }),
  get: get('/products/:productCode', productSchema, { auth: false }),
  listFxRates: get('/fx/rates', z.array(fxRateSchema)),
  createFxQuote: post('/fx/quotes', fxQuoteSchema, {
    body: fxQuoteRequestSchema,
    idempotent: true,
  }),
};

export function createProductsApi(call: Requester) {
  return {
    list: (options?: RequestOptions) => call(productsEndpoints.list, { options }),
    rates: (options?: RequestOptions) => call(productsEndpoints.rates, { options }),
    get: (productCode: string, options?: RequestOptions) =>
      call(productsEndpoints.get, { params: { productCode }, options }),
    listFxRates: (options?: RequestOptions) => call(productsEndpoints.listFxRates, { options }),
    createFxQuote: (body: z.input<typeof fxQuoteRequestSchema>, options?: RequestOptions) =>
      call(productsEndpoints.createFxQuote, { body, options }),
  };
}

export type ProductsApi = ReturnType<typeof createProductsApi>;
