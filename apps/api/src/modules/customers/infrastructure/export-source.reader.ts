import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { AccountDoc } from '../../accounts/infrastructure/account.schemas.js';
import { CustomersService } from '../customers.service.js';
import { EXPORT_SESSION_LIMIT } from '../customers.constants.js';
import type { FootprintInput } from './export-footprint.js';
import { SessionDoc, UserCredentialDoc } from './customer.schemas.js';

/**
 * Gathers the raw material of a data export from the four collections that hold it.
 *
 * Grouped behind one reader so the export service is about *rendering and delivery*, not about
 * which collection a session lives in — and so the query discipline is in one place: the
 * credential read names its columns explicitly, because a `.select()` that pulled
 * `passwordHash` into a data export would be a breach shipped as a feature.
 */
@Injectable()
export class ExportSourceReader {
  constructor(
    @InjectModel(UserCredentialDoc.name) private readonly credentials: Model<UserCredentialDoc>,
    @InjectModel(SessionDoc.name) private readonly sessions: Model<SessionDoc>,
    @InjectModel(AccountDoc.name) private readonly accounts: Model<AccountDoc>,
    private readonly profiles: CustomersService,
  ) {}

  async gather(
    customerId: string,
    generatedAt: Date,
    reference: string,
  ): Promise<FootprintInput> {
    const customer = await this.profiles.require(customerId);

    const [credential, accounts] = await Promise.all([
      this.credentials
        .findOne({ customerId })
        .select('emailVerified lastLoginAt')
        .lean(),
      this.accounts.find({ customerId }).sort({ openedAt: 1 }).lean(),
    ]);

    // Sessions belong to the credential, not the customer — one customer, one credential today.
    const sessions = credential
      ? await this.sessions
          .find({ userId: credential._id })
          .sort({ lastSeenAt: -1 })
          .limit(EXPORT_SESSION_LIMIT)
          .lean()
      : [];

    return { customer, credential, sessions, accounts, generatedAt, reference };
  }
}
