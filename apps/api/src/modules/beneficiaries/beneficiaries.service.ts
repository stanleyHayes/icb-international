import type {
  Beneficiary,
  BeneficiaryQuery,
  CreateBeneficiaryRequest,
  CursorPage,
  UpdateBeneficiaryRequest,
} from '@icb/contracts';
import { isGreaterThan, type Money } from '@icb/money';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { ClientSession, Model } from 'mongoose';

import { ConflictError, NotFoundError } from '../../common/errors/index.js';
import { buildCursorPage, decodeCursor } from '../../common/pagination/cursor.js';
import { isDuplicateKeyError } from '../../infrastructure/database/mongo-errors.js';
import { ClockService } from '../../simulation/clock/clock.service.js';
import { BeneficiaryTargetResolver } from './application/beneficiary-target.resolver.js';
import { destinationKey } from './domain/beneficiary-destination.js';
import {
  BeneficiaryCoolingOffError,
  BeneficiaryUnverifiedError,
} from './domain/beneficiary-errors.js';
import {
  COOLING_OFF_CAP_MAJOR_UNITS,
  UNVERIFIED_CAP_MAJOR_UNITS,
  capFor,
  isCoolingOff,
} from './domain/cooling-off.js';
import {
  buildBeneficiaryDocument,
  type NewBeneficiary,
} from './infrastructure/beneficiary.factory.js';
import { toBeneficiary } from './infrastructure/beneficiary.mapper.js';
import { BeneficiaryDoc } from './infrastructure/beneficiary.schemas.js';

/** User-supplied search text goes into a regex, so metacharacters must be neutralised. */
function escapeRegex(value: string): string {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Saved payees.
 *
 * The interesting part of this service is not the CRUD — it is `assertUsable`, which every
 * money-moving path must call before paying a saved payee. Authorised-push-payment fraud is the
 * dominant loss channel in retail banking and it is executed through the beneficiary list, so
 * the cap lives here, next to the data it depends on, rather than in each rail.
 */
@Injectable()
export class BeneficiariesService {
  private readonly logger = new Logger(BeneficiariesService.name);

  constructor(
    @InjectModel(BeneficiaryDoc.name) private readonly beneficiaries: Model<BeneficiaryDoc>,
    private readonly targets: BeneficiaryTargetResolver,
    private readonly clock: ClockService,
  ) {}

  async create(customerId: string, request: CreateBeneficiaryRequest): Promise<Beneficiary> {
    const target = await this.targets.resolve(request.destination, customerId);
    const key = destinationKey(request.destination);
    await this.assertNotDuplicate(customerId, key);

    const addedAt = this.clock.now();
    const created = await this.insert({ customerId, request, key, target, addedAt });

    this.logger.log(
      { beneficiaryId: created._id, coolingOffUntil: created.coolingOffUntil.toISOString() },
      'Beneficiary saved',
    );
    return toBeneficiary(created);
  }

  private async insert(input: NewBeneficiary): Promise<BeneficiaryDoc> {
    try {
      const document = buildBeneficiaryDocument(input);
      const [created] = await this.beneficiaries.create([document], { ordered: true });
      if (!created) {
        throw new ConflictError('The beneficiary could not be saved');
      }
      return created;
    } catch (error) {
      // The unique index is the real guard; the pre-check above only buys a friendlier message.
      if (isDuplicateKeyError(error)) {
        throw duplicateError(input.target.displayIdentifier);
      }
      throw error;
    }
  }

  private async assertNotDuplicate(customerId: string, key: string): Promise<void> {
    const existing = await this.beneficiaries.findOne({ customerId, destinationKey: key }).lean();
    if (existing) {
      throw duplicateError(existing.displayIdentifier);
    }
  }

  async list(customerId: string, query: BeneficiaryQuery): Promise<CursorPage<Beneficiary>> {
    const filter = this.buildFilter(customerId, query);
    const rows = await this.beneficiaries
      .find(filter)
      .sort({ _id: 1 })
      .limit(query.limit + 1)
      .lean();

    const page = buildCursorPage(rows, query.limit, (row) => row._id);
    return { ...page, items: page.items.map(toBeneficiary) };
  }

  private buildFilter(customerId: string, query: BeneficiaryQuery): Record<string, unknown> {
    const filter: Record<string, unknown> = { customerId };
    if (query.cursor) {
      filter['_id'] = { $gt: decodeCursor(query.cursor) };
    }
    if (query.favouritesOnly) {
      filter['favourite'] = true;
    }
    if (query.verifiedOnly) {
      filter['verified'] = true;
    }
    if (query.q) {
      const pattern = { $regex: escapeRegex(query.q), $options: 'i' };
      filter['$or'] = [{ name: pattern }, { nickname: pattern }, { displayIdentifier: pattern }];
    }
    return filter;
  }

  async get(customerId: string, beneficiaryId: string): Promise<Beneficiary> {
    return toBeneficiary(await this.loadOwned(beneficiaryId, customerId));
  }

  async update(
    customerId: string,
    beneficiaryId: string,
    request: UpdateBeneficiaryRequest,
  ): Promise<Beneficiary> {
    const update: Record<string, unknown> = {};
    if (request.nickname !== undefined) {
      update['nickname'] = request.nickname;
    }
    if (request.favourite !== undefined) {
      update['favourite'] = request.favourite;
    }

    // Ownership is part of the filter, never a comparison made after reading the document.
    const updated = await this.beneficiaries
      .findOneAndUpdate({ _id: beneficiaryId, customerId }, { $set: update }, { new: true })
      .lean();

    if (!updated) {
      throw new NotFoundError('Beneficiary', beneficiaryId);
    }
    return toBeneficiary(updated);
  }

  /**
   * Deleting is a hard delete, and safe: every transfer stores its own resolved destination, so
   * history does not point back here and nothing is orphaned by removal.
   */
  async remove(customerId: string, beneficiaryId: string): Promise<void> {
    const result = await this.beneficiaries.deleteOne({ _id: beneficiaryId, customerId });
    if (result.deletedCount === 0) {
      throw new NotFoundError('Beneficiary', beneficiaryId);
    }
  }

  async loadOwned(beneficiaryId: string, customerId?: string): Promise<BeneficiaryDoc> {
    const filter = customerId ? { _id: beneficiaryId, customerId } : { _id: beneficiaryId };
    const doc = await this.beneficiaries.findOne(filter).lean();
    if (!doc) {
      throw new NotFoundError('Beneficiary', beneficiaryId);
    }
    return doc;
  }

  /**
   * The control. Call this before moving money to a saved payee — it is the only thing standing
   * between a hijacked session and an emptied account.
   *
   * A fresh payee is capped, not blocked, so a genuine customer is inconvenienced rather than
   * stopped; an unverified payee stays capped at a higher ceiling until the micro-deposits are
   * confirmed. Both caps are denominated in the currency actually being sent.
   */
  async assertUsable(
    beneficiaryId: string,
    amount: Money,
    customerId?: string,
  ): Promise<BeneficiaryDoc> {
    const doc = await this.loadOwned(beneficiaryId, customerId);
    const now = this.clock.now();

    if (isCoolingOff(doc.coolingOffUntil, now)) {
      const cap = capFor(COOLING_OFF_CAP_MAJOR_UNITS, amount.currency);
      if (isGreaterThan(amount, cap)) {
        throw new BeneficiaryCoolingOffError(beneficiaryId, amount, cap, doc.coolingOffUntil);
      }
    }

    if (!doc.verified) {
      const cap = capFor(UNVERIFIED_CAP_MAJOR_UNITS, amount.currency);
      if (isGreaterThan(amount, cap)) {
        throw new BeneficiaryUnverifiedError(beneficiaryId, amount, cap);
      }
    }
    return doc;
  }

  /** Usage stats, so the list can surface the payees a customer actually uses. */
  async recordUsage(beneficiaryId: string, session?: ClientSession): Promise<void> {
    const query = this.beneficiaries.updateOne(
      { _id: beneficiaryId },
      { $inc: { useCount: 1 }, $set: { lastUsedAt: this.clock.now() } },
    );
    await (session ? query.session(session) : query);
  }
}

function duplicateError(displayIdentifier: string): ConflictError {
  return new ConflictError('You have already saved a payee with this destination', {
    displayIdentifier,
  });
}
