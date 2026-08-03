import { annotateTransactionRequestSchema } from '@icb/contracts';
import type { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { newId } from '../../infrastructure/database/identifier.js';
import { TransactionAnnotationDoc } from './infrastructure/transaction-annotation.schemas.js';

/** The contracts package exports the schema but no alias for it; inferred once, here. */
type AnnotateTransactionRequest = z.infer<typeof annotateTransactionRequestSchema>;

/**
 * The notes/tags/category layer customers write on their own transactions.
 *
 * Ownership (`customerId`) is part of every query, so an annotation can never be read or
 * written across customers even if a caller guesses a transaction id. Writes are upserts on
 * the unique (customer, transaction) pair: annotating is declarative — "the note is now X" —
 * which makes a retried PATCH naturally idempotent without a stored response.
 */
@Injectable()
export class TransactionAnnotationsService {
  constructor(
    @InjectModel(TransactionAnnotationDoc.name)
    private readonly annotations: Model<TransactionAnnotationDoc>,
  ) {}

  /** All annotations for a set of transactions, keyed by transaction id. One query per page. */
  async getForTransactions(
    customerId: string,
    transactionIds: string[],
  ): Promise<Map<string, TransactionAnnotationDoc>> {
    if (transactionIds.length === 0) {
      return new Map();
    }

    const rows = await this.annotations
      .find({ customerId, transactionId: { $in: transactionIds } })
      .lean();
    return new Map(rows.map((row) => [row.transactionId, row]));
  }

  /** One customer's annotation for one transaction, or null when they never wrote one. */
  async getForTransaction(
    customerId: string,
    transactionId: string,
  ): Promise<TransactionAnnotationDoc | null> {
    return this.annotations.findOne({ customerId, transactionId }).lean();
  }

  /**
   * Applies a patch. Only the fields present in the request are touched — a note-only PATCH
   * leaves tags alone. `note: null` clears the note, which the contract expresses explicitly.
   */
  async upsert(
    customerId: string,
    transactionId: string,
    patch: AnnotateTransactionRequest,
  ): Promise<TransactionAnnotationDoc> {
    const set: Record<string, unknown> = {};
    if (patch.note !== undefined) {
      set['note'] = patch.note;
    }
    if (patch.category !== undefined) {
      set['category'] = patch.category;
    }
    if (patch.tags !== undefined) {
      set['tags'] = normaliseTags(patch.tags);
    }

    const updated = await this.annotations
      .findOneAndUpdate(
        { customerId, transactionId },
        { $set: set, $setOnInsert: { _id: newId(), customerId, transactionId } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .lean();

    if (!updated) {
      // findOneAndUpdate with upsert+new never resolves null; this only satisfies the type.
      return this.annotations.findOne({ customerId, transactionId }).lean() as never;
    }
    return updated;
  }
}

/** Trimmed, de-duplicated, empties dropped — order preserved, first occurrence wins. */
export function normaliseTags(tags: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of tags) {
    const tag = raw.trim();
    if (tag.length > 0 && !seen.has(tag)) {
      seen.add(tag);
      result.push(tag);
    }
  }

  return result;
}
