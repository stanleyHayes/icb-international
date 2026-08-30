import type { AuthenticatedUser, RegisterRequest, StaffRole } from '@icb/contracts';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { DomainError } from '../../../common/errors/domain.error.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import {
  CustomerDoc,
  UserCredentialDoc,
} from '../../customers/infrastructure/customer.schemas.js';
import { SessionWriter, type RecordSessionInput } from './session-writer.js';

type CredentialView = Pick<
  UserCredentialDoc,
  '_id' | 'customerId' | 'email' | 'emailVerified' | 'roles' | 'lastLoginAt'
>;

/**
 * Identity persistence: the customer profile behind a login, and the session rows a login
 * produces. Grouping them here keeps AuthService about *policy* — lockouts, reuse detection,
 * rotation — rather than about document shapes.
 *
 * Staff principals have no customer record, so the name fields come back empty — callers render
 * the email instead rather than an awkward blank.
 */
@Injectable()
export class UserProfileReader {
  constructor(
    @InjectModel(CustomerDoc.name) private readonly customers: Model<CustomerDoc>,
    @InjectModel(UserCredentialDoc.name) private readonly credentials: Model<UserCredentialDoc>,
    private readonly sessionWriter: SessionWriter,
    private readonly clock: ClockService,
  ) {}

  /** The principal behind a live access token — the `GET /auth/me` read. */
  async currentUser(userId: string): Promise<AuthenticatedUser> {
    const credential = await this.credentials.findById(userId).lean();
    if (!credential) {
      throw new DomainError('UNAUTHENTICATED', 'Session is no longer valid');
    }
    return this.toAuthenticatedUser(credential);
  }

  async createCustomerRecord(
    customerId: string,
    email: string,
    request: RegisterRequest,
  ): Promise<void> {
    await this.customers.create([
      {
        _id: customerId,
        type: 'individual',
        status: 'pending_kyc',
        tier: 'standard',
        email,
        phone: request.phone,
        individual: { firstName: request.firstName, lastName: request.lastName },
        business: null,
        preferences: {
          locale: 'en',
          timezone: 'UTC',
          marketingEmail: false,
          marketingSms: false,
          statementDelivery: 'both',
        },
        kycStatus: 'not_started',
        riskRating: 'low',
        memberSince: this.clock.now(),
      },
    ]);
  }

  async recordSession(input: RecordSessionInput): Promise<void> {
    await this.sessionWriter.record(input);
  }

  async toAuthenticatedUser(credential: CredentialView): Promise<AuthenticatedUser> {
    const customer = credential.customerId
      ? await this.customers.findById(credential.customerId).lean()
      : null;
    const individual = customer?.individual as { firstName?: string; lastName?: string } | null;

    return {
      userId: credential._id,
      customerId: credential.customerId,
      email: credential.email,
      firstName: individual?.firstName ?? '',
      lastName: individual?.lastName ?? '',
      emailVerified: credential.emailVerified,
      roles: credential.roles as StaffRole[],
      lastLoginAt: credential.lastLoginAt?.toISOString() ?? null,
    };
  }
}
