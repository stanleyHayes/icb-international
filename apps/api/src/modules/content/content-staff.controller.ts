import {
  faqCreateRequestSchema,
  faqUpdateRequestSchema,
  locationCreateRequestSchema,
  locationUpdateRequestSchema,
  rateEntryUpsertRequestSchema,
  templatePreviewRequestSchema,
  templateUpsertRequestSchema,
  type ContentLocationView,
  type FaqArticleView,
  type RateEntryView,
  type TemplateOverrideView,
  type TemplatePreviewResult,
} from '@icb/contracts';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { AuditAction } from '../../common/decorators/audit-action.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { zodBody } from '../../common/pipes/zod-validation.pipe.js';
import type { AccessTokenClaims } from '../auth/application/token.service.js';
import { ContentRatesService } from './application/content-rates.service.js';
import { FaqService } from './application/faq.service.js';
import { LocationService } from './application/location.service.js';
import { TemplateOverrideService } from './application/template-override.service.js';
import { CONTENT_STAFF_ROLES } from './content.constants.js';

/**
 * Content management, staff side.
 *
 * Role-gated to the roles the console nav shows the Content section to, and every mutation
 * carries an audit action (N7). Preview is a read-only render, so it is deliberately not
 * audited — nothing changes.
 */
@Controller('admin/content')
@UseGuards(RolesGuard)
@Roles(...CONTENT_STAFF_ROLES)
export class ContentStaffController {
  constructor(
    private readonly faq: FaqService,
    private readonly locations: LocationService,
    private readonly templates: TemplateOverrideService,
    private readonly rates: ContentRatesService,
  ) {}

  // ---- FAQ articles --------------------------------------------------------

  @Get('faq')
  listFaq(): Promise<FaqArticleView[]> {
    return this.faq.listAll();
  }

  @Post('faq')
  @AuditAction('content.faq.create')
  createFaq(
    @CurrentUser() staff: AccessTokenClaims,
    @Body(zodBody(faqCreateRequestSchema))
    body: ReturnType<typeof faqCreateRequestSchema.parse>,
  ): Promise<FaqArticleView> {
    return this.faq.create(staff, body);
  }

  @Patch('faq/:articleId')
  @AuditAction('content.faq.update')
  updateFaq(
    @Param('articleId') articleId: string,
    @Body(zodBody(faqUpdateRequestSchema))
    body: ReturnType<typeof faqUpdateRequestSchema.parse>,
  ): Promise<FaqArticleView> {
    return this.faq.update(articleId, body);
  }

  @Delete('faq/:articleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @AuditAction('content.faq.delete')
  removeFaq(@Param('articleId') articleId: string): Promise<void> {
    return this.faq.remove(articleId);
  }

  // ---- Branches & ATMs -----------------------------------------------------

  @Get('locations')
  listLocations(): Promise<ContentLocationView[]> {
    return this.locations.listAll();
  }

  @Post('locations')
  @AuditAction('content.locations.create')
  createLocation(
    @Body(zodBody(locationCreateRequestSchema))
    body: ReturnType<typeof locationCreateRequestSchema.parse>,
  ): Promise<ContentLocationView> {
    return this.locations.create(body);
  }

  @Patch('locations/:locationId')
  @AuditAction('content.locations.update')
  updateLocation(
    @Param('locationId') locationId: string,
    @Body(zodBody(locationUpdateRequestSchema))
    body: ReturnType<typeof locationUpdateRequestSchema.parse>,
  ): Promise<ContentLocationView> {
    return this.locations.update(locationId, body);
  }

  @Delete('locations/:locationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @AuditAction('content.locations.delete')
  removeLocation(@Param('locationId') locationId: string): Promise<void> {
    return this.locations.remove(locationId);
  }

  // ---- Notification template overrides -------------------------------------

  @Get('templates')
  listTemplates(): Promise<TemplateOverrideView[]> {
    return this.templates.list();
  }

  /** Render candidate copy against sample data. Declared before `:templateId` routes. */
  @Post('templates/preview')
  @HttpCode(HttpStatus.OK)
  previewTemplate(
    @Body(zodBody(templatePreviewRequestSchema))
    body: ReturnType<typeof templatePreviewRequestSchema.parse>,
  ): TemplatePreviewResult {
    return this.templates.preview(body);
  }

  @Post('templates')
  @AuditAction('content.templates.upsert')
  upsertTemplate(
    @CurrentUser() staff: AccessTokenClaims,
    @Body(zodBody(templateUpsertRequestSchema))
    body: ReturnType<typeof templateUpsertRequestSchema.parse>,
  ): Promise<TemplateOverrideView> {
    return this.templates.upsert(staff, body);
  }

  @Delete('templates/:templateId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @AuditAction('content.templates.delete')
  removeTemplate(@Param('templateId') templateId: string): Promise<void> {
    return this.templates.remove(templateId);
  }

  // ---- Rate-table entries ----------------------------------------------------

  @Get('rates')
  listRateEntries(): Promise<RateEntryView[]> {
    return this.rates.list();
  }

  @Post('rates')
  @AuditAction('content.rates.upsert')
  upsertRateEntry(
    @CurrentUser() staff: AccessTokenClaims,
    @Body(zodBody(rateEntryUpsertRequestSchema))
    body: ReturnType<typeof rateEntryUpsertRequestSchema.parse>,
  ): Promise<RateEntryView> {
    return this.rates.upsert(staff, body);
  }

  @Delete('rates/:entryId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @AuditAction('content.rates.delete')
  removeRateEntry(@Param('entryId') entryId: string): Promise<void> {
    return this.rates.remove(entryId);
  }
}
