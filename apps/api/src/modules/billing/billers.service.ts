import type { Biller, CursorPage, billerQuerySchema } from '@icb/contracts';
import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { ConflictError, NotFoundError } from '../../common/errors/index.js';
import { CONFIG, type AppConfiguration } from '../../config/configuration.js';
import { newId } from '../../infrastructure/database/identifier.js';
import { BILLER_DIRECTORY, BILLER_LOGO_BASE_URL, type BillerSeed } from './domain/biller-directory.js';
import { toBiller } from './infrastructure/biller.mapper.js';
import { BillerDoc } from './infrastructure/biller.schemas.js';

type BillerQuery = ReturnType<typeof billerQuerySchema.parse>;

/** User-supplied search text goes into a regex, so metacharacters must be neutralised. */
function escapeRegex(value: string): string {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The biller directory.
 *
 * Seeded on boot and re-seeded on every boot, by upsert on the biller's stable `code`. That is
 * what makes it safe to run repeatedly: names, fees and failure rates are refreshed from the
 * shipped directory, while `_id` — the value every linked bill points at — never changes.
 */
@Injectable()
export class BillersService implements OnModuleInit {
  private readonly logger = new Logger(BillersService.name);

  constructor(
    @InjectModel(BillerDoc.name) private readonly billers: Model<BillerDoc>,
    @Inject(CONFIG) private readonly config: AppConfiguration,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedDirectory();
  }

  async seedDirectory(): Promise<void> {
    for (const seed of BILLER_DIRECTORY) {
      await this.billers.updateOne(
        { code: seed.code },
        { $set: this.toDocumentFields(seed), $setOnInsert: { _id: newId() } },
        { upsert: true },
      );
    }
    this.logger.log({ billers: BILLER_DIRECTORY.length }, 'Biller directory seeded');
  }

  private toDocumentFields(seed: BillerSeed): Omit<BillerDoc, '_id' | 'code'> {
    return {
      name: seed.name,
      category: seed.category,
      logoUrl: `${BILLER_LOGO_BASE_URL}${seed.code.toLowerCase()}.svg`,
      referenceLabel: seed.referenceLabel,
      referencePattern: seed.referencePattern,
      supportsBalanceEnquiry: seed.supportsBalanceEnquiry,
      minimumAmountMinorUnits: seed.minimumAmountMinorUnits,
      feeMinorUnits: seed.feeMinorUnits,
      failureRate: seed.failureRate,
      typicalBillMinorUnits: seed.typicalBillMinorUnits,
      currency: this.config.bank.baseCurrency,
      active: true,
    };
  }

  /**
   * The directory, paged.
   *
   * Sorted and cursored on `_id`, which is a ULID minted in seed order — so the page order is the
   * curated directory order, and the cursor stays correct as billers are added.
   */
  async list(query: BillerQuery): Promise<CursorPage<Biller>> {
    const filter: Record<string, unknown> = { active: true };
    if (query.cursor) {
      filter['_id'] = { $gt: query.cursor };
    }
    if (query.category) {
      filter['category'] = query.category;
    }
    if (query.q) {
      filter['name'] = { $regex: escapeRegex(query.q), $options: 'i' };
    }

    // One extra row tells us whether another page exists without a second count query.
    const rows = await this.billers.find(filter).sort({ _id: 1 }).limit(query.limit + 1).lean();
    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;

    return {
      items: page.map(toBiller),
      nextCursor: hasMore ? (page[page.length - 1]?._id ?? null) : null,
      hasMore,
    };
  }

  async get(billerId: string): Promise<BillerDoc> {
    const biller = await this.billers.findById(billerId).lean();
    if (!biller) {
      throw new NotFoundError('Biller', billerId);
    }
    return biller;
  }

  /** A biller that has been withdrawn keeps its history but accepts no new money. */
  async requireActive(billerId: string): Promise<BillerDoc> {
    const biller = await this.get(billerId);
    if (!biller.active) {
      throw new ConflictError('This biller is no longer accepting payments', { billerId });
    }
    return biller;
  }

  async findByIds(billerIds: readonly string[]): Promise<Map<string, BillerDoc>> {
    const rows = await this.billers.find({ _id: { $in: [...billerIds] } }).lean();
    return new Map(rows.map((row) => [row._id, row]));
  }
}
