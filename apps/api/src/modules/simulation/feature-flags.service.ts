import type { FeatureFlag, updateFeatureFlagRequestSchema } from '@icb/contracts';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import type { z } from 'zod';

import { NotFoundError } from '../../common/errors/index.js';
import { newId } from '../../infrastructure/database/identifier.js';
import { ClockService } from '../../simulation/clock/clock.service.js';
import { DEFAULT_FEATURE_FLAGS, type FeatureFlagSeed } from './domain/feature-flags.constants.js';
import { toFeatureFlag } from './infrastructure/simulation.mapper.js';
import { SimFeatureFlagDoc } from './infrastructure/simulation.schemas.js';

export type FeatureFlagPatch = z.infer<typeof updateFeatureFlagRequestSchema>;

const FULL_ROLLOUT = 100;

/**
 * Runtime feature flags.
 *
 * Evaluation is by a *stable* hash of the subject id, not a random draw: a customer who is inside
 * a 10% rollout stays inside it on the next request, and on the next deploy. A flag that flickers
 * per request is worse than no flag at all — it produces bug reports nobody can reproduce.
 */
@Injectable()
export class FeatureFlagsService {
  private readonly logger = new Logger(FeatureFlagsService.name);

  constructor(
    @InjectModel(SimFeatureFlagDoc.name) private readonly flags: Model<SimFeatureFlagDoc>,
    private readonly clock: ClockService,
  ) {}

  /** Every flag, seeding the shipped defaults the first time it is asked. */
  async list(): Promise<FeatureFlag[]> {
    await this.seedDefaults();
    const documents = await this.flags.find().sort({ key: 1 }).lean();
    return documents.map(toFeatureFlag);
  }

  async get(key: string): Promise<FeatureFlag> {
    await this.seedDefaults();
    const document = await this.flags.findOne({ key }).lean();
    if (!document) {
      throw new NotFoundError('Feature flag', key);
    }
    return toFeatureFlag(document);
  }

  async update(key: string, patch: FeatureFlagPatch): Promise<FeatureFlag> {
    const current = await this.get(key);

    const next = {
      enabled: patch.enabled ?? current.enabled,
      rolloutPercentage: patch.rolloutPercentage ?? current.rolloutPercentage,
      audience: patch.audience ?? current.audience,
      updatedAt: this.clock.now(),
    };

    await this.flags.updateOne({ key }, { $set: next });
    this.logger.warn({ key, patch }, 'Feature flag changed');
    return this.get(key);
  }

  /**
   * Whether a flag is on for one subject.
   *
   * A disabled flag is off for everyone regardless of rollout — the toggle is the kill switch, and
   * an operator turning it off during an incident must not have to also zero the percentage.
   */
  async isEnabled(key: string, subjectId: string): Promise<boolean> {
    const flag = await this.flags.findOne({ key }).lean();
    if (!flag?.enabled) {
      return false;
    }
    if (flag.rolloutPercentage >= FULL_ROLLOUT) {
      return true;
    }
    return bucketFor(`${key}:${subjectId}`) < flag.rolloutPercentage;
  }

  /** Insert any shipped flag that has never been stored. Existing rows are left alone. */
  private async seedDefaults(): Promise<void> {
    const existing = await this.flags.find({}, { key: 1 }).lean();
    const known = new Set(existing.map((row) => row.key));
    const missing = DEFAULT_FEATURE_FLAGS.filter((seed) => !known.has(seed.key));

    if (missing.length === 0) {
      return;
    }
    await this.flags.insertMany(missing.map((seed) => this.toDocument(seed)), { ordered: false });
  }

  private toDocument(seed: FeatureFlagSeed): SimFeatureFlagDoc {
    return {
      _id: newId(),
      key: seed.key,
      label: seed.label,
      description: seed.description,
      enabled: seed.enabled,
      rolloutPercentage: seed.rolloutPercentage,
      audience: seed.audience,
      updatedAt: this.clock.now(),
    };
  }
}

/**
 * FNV-1a over the flag key and subject id, folded into 0–99.
 *
 * Including the key means a customer in the first 10% of one rollout is not automatically in the
 * first 10% of every other one, which would concentrate every experiment on the same people.
 */
function bucketFor(value: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0) % FULL_ROLLOUT;
}
