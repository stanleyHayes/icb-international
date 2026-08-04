import { z } from 'zod';

import { ledgerIntegrityReportSchema } from '../simulation/simulation.contract.js';

export const liveHealthSchema = z.object({
  status: z.literal('ok'),
  uptimeSeconds: z.number().int().nonnegative(),
  bank: z.string(),
});

export const readinessHealthSchema = z.object({
  status: z.enum(['ready', 'not_ready']),
  database: z.string(),
  serverTime: z.iso.datetime(),
  businessDate: z.iso.date(),
});

export { ledgerIntegrityReportSchema };

export type LiveHealth = z.infer<typeof liveHealthSchema>;
export type ReadinessHealth = z.infer<typeof readinessHealthSchema>;
