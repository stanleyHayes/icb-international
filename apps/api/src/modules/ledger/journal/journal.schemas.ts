import {
  cursorQuerySchema,
  currencySchema,
  isoDateSchema,
  transactionStatusSchema,
  transactionTypeSchema,
} from '@icb/contracts';
import { z } from 'zod';

/**
 * Filters for the ledger journal.
 *
 * Cursor-paginated like every unbounded list in the system: the journal grows with every
 * posting, so offset paging would silently skip or repeat rows mid-scroll. `from`/`to` close
 * over `valueDate`, the date that matters for accounting.
 *
 * Declared locally because the journal route is not part of the published SDK surface; if SDK-01
 * later adopts it, this schema moves into `@icb/contracts` unchanged.
 */
export const journalQuerySchema = cursorQuerySchema
  .extend({
    reference: z.string().max(64).optional(),
    type: transactionTypeSchema.optional(),
    status: transactionStatusSchema.optional(),
    /** Narrow to transactions that posted at least one entry against this account reference. */
    accountRef: z.string().max(80).optional(),
    currency: currencySchema.optional(),
    from: isoDateSchema.optional(),
    to: isoDateSchema.optional(),
  })
  .refine((query) => !query.from || !query.to || query.from <= query.to, {
    error: 'The start of a date range must not be after its end',
    path: ['from'],
  });

export type JournalQuery = z.infer<typeof journalQuerySchema>;
