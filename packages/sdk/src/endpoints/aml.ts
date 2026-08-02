import { z } from 'zod';
import {
  amlAlertQuerySchema,
  amlAlertSchema,
  fileReportRequestSchema,
  offsetPageSchema,
  updateAmlAlertRequestSchema,
} from '@icb/contracts';

import { get, patch, post, type Requester } from '../endpoint.js';
import { type RequestOptions } from '../http.js';

export const amlEndpoints = {
  listAlerts: get('/admin/aml/alerts', offsetPageSchema(amlAlertSchema)),
  getAlert: get('/admin/aml/alerts/:alertId', amlAlertSchema),
  updateAlert: patch('/admin/aml/alerts/:alertId', amlAlertSchema, {
    body: updateAmlAlertRequestSchema,
  }),
  fileReport: post('/admin/aml/alerts/:alertId/reports', amlAlertSchema, {
    body: fileReportRequestSchema,
    idempotent: true,
  }),
};

export function createAmlApi(call: Requester) {
  return {
    listAlerts: (query?: z.input<typeof amlAlertQuerySchema>, options?: RequestOptions) =>
      call(amlEndpoints.listAlerts, { query, options }),
    getAlert: (alertId: string, options?: RequestOptions) =>
      call(amlEndpoints.getAlert, { params: { alertId }, options }),
    updateAlert: (
      alertId: string,
      body: z.input<typeof updateAmlAlertRequestSchema>,
      options?: RequestOptions,
    ) => call(amlEndpoints.updateAlert, { params: { alertId }, body, options }),
    fileReport: (
      alertId: string,
      body: z.input<typeof fileReportRequestSchema>,
      options?: RequestOptions,
    ) => call(amlEndpoints.fileReport, { params: { alertId }, body, options }),
  };
}

export type AmlApi = ReturnType<typeof createAmlApi>;
