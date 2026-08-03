import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { newId } from '../../infrastructure/database/identifier.js';
import { PasswordService } from '../../modules/auth/application/password.service.js';
import {
  CustomerDoc,
  UserCredentialDoc,
} from '../../modules/customers/infrastructure/customer.schemas.js';
import { ClockService } from '../clock/clock.service.js';
import type { RandomHelpers } from './random.js';
import { STAFF_PASSWORD, type SeedPersona } from './seed.data.js';

const DAY_MS = 86_400_000;

/**
 * Writes the identity records a seeded bank needs.
 *
 * Separate from SeedService so that "who exists" and "what they did" stay apart: the former is
 * a handful of document writes, the latter is eighteen months of ledger postings.
 */
@Injectable()
export class SeedIdentityService {
  constructor(
    @InjectModel(CustomerDoc.name) private readonly customers: Model<CustomerDoc>,
    @InjectModel(UserCredentialDoc.name) private readonly credentials: Model<UserCredentialDoc>,
    private readonly passwords: PasswordService,
    private readonly clock: ClockService,
  ) {}

  async createPersona(
    persona: SeedPersona,
    customerId: string,
    random: RandomHelpers,
  ): Promise<void> {
    const now = this.clock.now();

    await this.customers.create([
      {
        _id: customerId,
        type: 'individual',
        status: 'active',
        tier: persona.tier,
        email: persona.email,
        phone: persona.phone,
        individual: {
          firstName: persona.firstName,
          lastName: persona.lastName,
          nationality: persona.country,
        },
        business: null,
        residentialAddress: {
          line1: `${random.int(1, 240)} Harbour Road`,
          line2: null,
          city: persona.city,
          region: null,
          postalCode: null,
          country: persona.country,
        },
        postalAddress: null,
        preferences: {
          locale: 'en',
          timezone: 'UTC',
          marketingEmail: true,
          marketingSms: false,
          statementDelivery: 'both',
        },
        kycLevel: 'tier_3',
        kycStatus: 'approved',
        kycVerifiedAt: new Date(now.getTime() - 400 * DAY_MS),
        riskRating: 'low',
        memberSince: new Date(now.getTime() - 720 * DAY_MS),
      },
    ]);

    await this.credentials.create([
      {
        _id: newId(),
        customerId,
        email: persona.email,
        passwordHash: await this.passwords.hash(persona.password),
        emailVerified: true,
        roles: [],
        active: true,
      },
    ]);
  }

  /** Upserted so re-seeding without a reset does not duplicate the operations team. */
  async createStaff(staff: { email: string; roles: readonly string[] }): Promise<void> {
    await this.credentials.updateOne(
      { email: staff.email },
      {
        $setOnInsert: {
          _id: newId(),
          customerId: null,
          email: staff.email,
          passwordHash: await this.passwords.hash(STAFF_PASSWORD),
          emailVerified: true,
          roles: [...staff.roles],
          active: true,
        },
      },
      { upsert: true },
    );
  }

  /** How many customers already exist — what tells a seed run whether it would be a second one. */
  async countCustomers(): Promise<number> {
    return this.customers.estimatedDocumentCount();
  }
}
