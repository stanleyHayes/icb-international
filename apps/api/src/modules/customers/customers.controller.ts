import {
  updatePreferencesRequestSchema,
  updateProfileRequestSchema,
  type CustomerProfile,
  type DownloadLink,
} from '@icb/contracts';
import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';

import { CurrentCustomer } from '../../common/decorators/current-user.decorator.js';
import { zodBody } from '../../common/pipes/zod-validation.pipe.js';
import { CustomerExportService } from './customer-export.service.js';
import { CustomersService } from './customers.service.js';

/**
 * The customer's own profile.
 *
 * Every handler takes the customer from the verified token via `@CurrentCustomer()` — identity
 * comes from the access token, never from a path or body parameter, so these routes cannot be
 * aimed at anyone else's record.
 */
@Controller('customers')
export class CustomersController {
  constructor(
    private readonly customers: CustomersService,
    private readonly exports: CustomerExportService,
  ) {}

  @Get('me')
  async me(@CurrentCustomer() customerId: string): Promise<CustomerProfile> {
    return this.customers.me(customerId);
  }

  @Patch('me')
  async updateMe(
    @CurrentCustomer() customerId: string,
    @Body(zodBody(updateProfileRequestSchema))
    body: ReturnType<typeof updateProfileRequestSchema.parse>,
  ): Promise<CustomerProfile> {
    return this.customers.updateProfile(customerId, body);
  }

  @Patch('me/preferences')
  async updatePreferences(
    @CurrentCustomer() customerId: string,
    @Body(zodBody(updatePreferencesRequestSchema))
    body: ReturnType<typeof updatePreferencesRequestSchema.parse>,
  ): Promise<CustomerProfile> {
    return this.customers.updatePreferences(customerId, body);
  }

  /** GDPR-style export: the full footprint as a PDF behind a signed, expiring link. */
  @Post('me/export')
  @HttpCode(HttpStatus.OK)
  async exportData(@CurrentCustomer() customerId: string): Promise<DownloadLink> {
    return this.exports.exportData(customerId);
  }
}
