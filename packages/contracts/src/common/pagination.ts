import { z } from 'zod';

/**
 * Pagination primitives.
 *
 * Cursor pagination is the default for anything that grows without bound (transactions, audit
 * events, notifications) because offset pagination silently skips or repeats rows when new
 * records arrive mid-scroll — unacceptable on a statement. Offset pagination is available only
 * for bounded admin tables where a page number is genuinely useful.
 */

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export const cursorQuerySchema = z.object({
  cursor: z.string().max(256).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

export type CursorQuery = z.infer<typeof cursorQuerySchema>;

export const offsetQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

export type OffsetQuery = z.infer<typeof offsetQuerySchema>;

export const sortDirectionSchema = z.enum(['asc', 'desc']);
export type SortDirection = z.infer<typeof sortDirectionSchema>;

/** Builds a typed cursor page schema for a given item schema. */
export function cursorPageSchema<TItem extends z.ZodType>(
  item: TItem,
): z.ZodObject<{
  items: z.ZodArray<TItem>;
  nextCursor: z.ZodNullable<z.ZodString>;
  hasMore: z.ZodBoolean;
}> {
  return z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(),
    hasMore: z.boolean(),
  });
}

export interface CursorPage<TItem> {
  items: TItem[];
  nextCursor: string | null;
  hasMore: boolean;
}

/** Builds a typed offset page schema for a given item schema. */
export function offsetPageSchema<TItem extends z.ZodType>(
  item: TItem,
): z.ZodObject<{
  items: z.ZodArray<TItem>;
  page: z.ZodNumber;
  limit: z.ZodNumber;
  total: z.ZodNumber;
  totalPages: z.ZodNumber;
}> {
  return z.object({
    items: z.array(item),
    page: z.int().min(1),
    limit: z.int().min(1),
    total: z.int().nonnegative(),
    totalPages: z.int().nonnegative(),
  });
}

export interface OffsetPage<TItem> {
  items: TItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** A closed date range filter, inclusive on both ends. */
export const dateRangeSchema = z
  .object({
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
  })
  .refine((range) => !range.from || !range.to || range.from <= range.to, {
    error: 'The start of a date range must not be after its end',
    path: ['from'],
  });

export type DateRange = z.infer<typeof dateRangeSchema>;

/** A closed amount range filter in minor units, inclusive on both ends. */
export const amountRangeSchema = z
  .object({
    min: z.coerce.number().int().optional(),
    max: z.coerce.number().int().optional(),
  })
  .refine((range) => range.min === undefined || range.max === undefined || range.min <= range.max, {
    error: 'The minimum of an amount range must not exceed its maximum',
    path: ['min'],
  });

export type AmountRange = z.infer<typeof amountRangeSchema>;
