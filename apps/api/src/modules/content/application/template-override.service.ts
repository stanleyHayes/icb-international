import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type {
  TemplateOverrideView,
  TemplatePreviewRequest,
  TemplatePreviewResult,
  TemplateUpsertRequest,
} from '@icb/contracts';
import type { Model } from 'mongoose';

import { NotFoundError } from '../../../common/errors/index.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import type { AccessTokenClaims } from '../../auth/application/token.service.js';
import { DEFAULT_TEMPLATE_SAMPLE } from '../content.constants.js';
import { renderTemplate } from '../domain/template-render.js';
import { toTemplateOverrideView } from '../infrastructure/content.mapper.js';
import { ContentTemplateOverrideDoc } from '../infrastructure/content.schemas.js';

/**
 * Notification template overrides.
 *
 * One override per (key, channel) — writes upsert rather than fail, because the operator's
 * mental model is "edit the copy for this slot", not "manage rows". Preview renders the
 * candidate copy against the built-in sample facts (plus anything the form supplied) without
 * persisting, and fails loudly on unknown `{{variables}}`.
 */
@Injectable()
export class TemplateOverrideService {
  constructor(
    @InjectModel(ContentTemplateOverrideDoc.name)
    private readonly overrides: Model<ContentTemplateOverrideDoc>,
    private readonly clock: ClockService,
  ) {}

  async list(): Promise<TemplateOverrideView[]> {
    const rows = await this.overrides.find().sort({ key: 1, channel: 1 }).lean();
    return rows.map(toTemplateOverrideView);
  }

  async upsert(staff: AccessTokenClaims, request: TemplateUpsertRequest): Promise<TemplateOverrideView> {
    const now = this.clock.now();
    const saved = await this.overrides
      .findOneAndUpdate(
        { key: request.key, channel: request.channel },
        {
          $set: { ...request, updatedBy: staff.sub, updatedAt: now },
          $setOnInsert: { createdAt: now },
        },
        { new: true, upsert: true },
      )
      .lean();
    return toTemplateOverrideView(saved);
  }

  async remove(templateId: string): Promise<void> {
    const result = await this.overrides.deleteOne({ _id: templateId });
    if (result.deletedCount === 0) {
      throw new NotFoundError('Template override', templateId);
    }
  }

  /** Render candidate copy against sample facts. Never persists. */
  preview(request: TemplatePreviewRequest): TemplatePreviewResult {
    const sample = this.sampleFor(request.sample);
    return {
      subject: request.subject === '' ? '' : renderTemplate(request.subject, sample),
      body: renderTemplate(request.body, sample),
    };
  }

  private sampleFor(extra: Record<string, string> | undefined): Record<string, string> {
    return {
      ...DEFAULT_TEMPLATE_SAMPLE,
      ...extra,
      // Always clock-derived — the form may override any fact but this one.
      occurredAt: this.clock.now().toISOString(),
    };
  }
}
