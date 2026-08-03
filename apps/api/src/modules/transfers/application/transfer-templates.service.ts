import type { createTransferTemplateRequestSchema, TransferTemplate } from '@icb/contracts';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { ConflictError, NotFoundError } from '../../../common/errors/index.js';
import { isDuplicateKeyError } from '../../../infrastructure/database/mongo-errors.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { toMoneyDto } from '../../accounts/infrastructure/account.mapper.js';
import {
  TransferTemplateDoc,
} from '../infrastructure/transfer-template.schemas.js';

/**
 * Saved transfer terms.
 *
 * A template is a set of terms the customer re-runs in one tap. Names are unique per customer —
 * enforced by the index, with the duplicate-key error translated into the domain's conflict —
 * because a picker with two identically named entries is how a customer pays the wrong payee.
 */
@Injectable()
export class TransferTemplatesService {
  constructor(
    @InjectModel(TransferTemplateDoc.name) private readonly templates: Model<TransferTemplateDoc>,
    private readonly clock: ClockService,
  ) {}

  async create(
    customerId: string,
    request: ReturnType<typeof createTransferTemplateRequestSchema.parse>,
  ): Promise<TransferTemplate> {
    try {
      const [created] = await this.templates.create(
        [{
          customerId,
          name: request.name,
          fromAccountId: request.fromAccountId,
          destination: request.destination,
          amountMinorUnits: request.amount?.minorUnits ?? null,
          currency: request.amount?.currency ?? null,
          reference: request.reference ?? null,
          lastUsedAt: null,
          useCount: 0,
        }],
        { ordered: true },
      );
      if (!created) {
        throw new ConflictError('The template could not be saved');
      }
      return this.toContract(created);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ConflictError('You already have a template with this name', {
          name: request.name,
        });
      }
      throw error;
    }
  }

  async list(customerId: string): Promise<TransferTemplate[]> {
    const rows = await this.templates
      .find({ customerId })
      .sort({ lastUsedAt: -1, name: 1 })
      .lean();
    return rows.map((row) => this.toContract(row));
  }

  async remove(customerId: string, templateId: string): Promise<void> {
    const result = await this.templates.deleteOne({ _id: templateId, customerId });
    if (result.deletedCount === 0) {
      throw new NotFoundError('Transfer template', templateId);
    }
  }

  /** Usage stats — the list surfaces the templates a customer actually reaches for. */
  async recordUsage(templateId: string): Promise<void> {
    await this.templates.updateOne(
      { _id: templateId },
      { $inc: { useCount: 1 }, $set: { lastUsedAt: this.clock.now() } },
    );
  }

  private toContract(row: TransferTemplateDoc): TransferTemplate {
    return {
      id: row._id,
      name: row.name,
      fromAccountId: row.fromAccountId,
      destination: row.destination as TransferTemplate['destination'],
      amount:
        row.amountMinorUnits === null || row.currency === null
          ? null
          : toMoneyDto(row.amountMinorUnits, row.currency),
      reference: row.reference,
      lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
      useCount: row.useCount,
    };
  }
}
