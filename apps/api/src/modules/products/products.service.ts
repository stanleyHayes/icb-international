import type { Product } from '@icb/contracts';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { ConflictError, NotFoundError } from '../../common/errors/index.js';
import { isDuplicateKeyError } from '../../infrastructure/database/mongo-errors.js';
import { persistenceFromProduct, toProduct } from './infrastructure/product.mapper.js';
import { ProductDoc } from './infrastructure/product.schemas.js';
import { RatesService } from './rates.service.js';

/**
 * The product catalogue.
 *
 * Products are configuration, not transactions: reads are unordered CRUD, writes are staff-only
 * and each one bumps `version` (optimistic concurrency, §5) and invalidates the cached rates
 * table. Other modules read through `documentFor` / `getByCode` — a product code in an account
 * or loan must resolve here, never against a local copy of the catalogue.
 */
@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(ProductDoc.name) private readonly products: Model<ProductDoc>,
    private readonly rates: RatesService,
  ) {}

  /** Active products in display order — the customer-facing catalogue. */
  async list(): Promise<Product[]> {
    const rows = await this.products
      .find({ active: true })
      .sort({ displayOrder: 1, code: 1 })
      .lean();
    return rows.map(toProduct);
  }

  /** Everything, including retired products — the staff view. */
  async listAll(): Promise<Product[]> {
    const rows = await this.products.find().sort({ displayOrder: 1, code: 1 }).lean();
    return rows.map(toProduct);
  }

  async getByCode(code: string): Promise<Product> {
    return toProduct(await this.documentFor(code));
  }

  /** The stored document, for pricing and eligibility lookups. */
  async documentFor(code: string): Promise<ProductDoc> {
    const doc = await this.products.findOne({ code }).lean();
    if (!doc) {
      throw new NotFoundError('Product', code);
    }
    return doc;
  }

  async create(input: Product): Promise<Product> {
    const existing = await this.products.exists({ code: input.code });
    if (existing !== null) {
      throw new ConflictError(`Product code ${input.code} is already in use`, { code: input.code });
    }
    const created = await this.insert(input);
    await this.rates.invalidate();
    return toProduct(created);
  }

  /**
   * Partial update with read-merge-write semantics: the wire shape is a full product, so the
   * patch is merged onto the current state and the result rewritten, preserving internal-only
   * fields (rate schedule, limits, fee tiers) that the wire never carries.
   */
  async update(code: string, patch: Partial<Product>): Promise<Product> {
    const current = await this.documentFor(code);
    const merged: Product = { ...toProduct(current), ...patch, code };
    const updated = await this.products
      .findOneAndUpdate(
        { code },
        { $set: persistenceFromProduct(merged, current), $inc: { version: 1 } },
        { new: true },
      )
      .lean();
    if (!updated) {
      throw new NotFoundError('Product', code);
    }
    await this.rates.invalidate();
    return toProduct(updated);
  }

  private async insert(input: Product): Promise<ProductDoc> {
    try {
      const [created] = await this.products.create([persistenceFromProduct(input)], {
        ordered: true,
      });
      if (!created) {
        throw new ConflictError('The product could not be saved');
      }
      return created;
    } catch (error) {
      // The unique index is the real guard; the pre-check only buys a friendlier message.
      if (isDuplicateKeyError(error)) {
        throw new ConflictError(`Product code ${input.code} is already in use`, {
          code: input.code,
        });
      }
      throw error;
    }
  }
}
