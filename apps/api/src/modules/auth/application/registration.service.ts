import type { AuthenticatedUser, RegisterRequest } from '@icb/contracts';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { ConflictError } from '../../../common/errors/index.js';
import { newId } from '../../../infrastructure/database/identifier.js';
import { UserCredentialDoc } from '../../customers/infrastructure/customer.schemas.js';
import { AUDIT_ACTIONS } from '../auth.constants.js';
import { AUDIT_OUTCOMES, AuditPort } from './audit.port.js';
import type { DeviceContext } from './auth.types.js';
import { EmailVerificationService } from './email-verification.service.js';
import { PasswordService } from './password.service.js';
import { UserProfileReader } from './user-profile-reader.js';

/**
 * Account opening.
 *
 * Registration creates the customer and credential records and sends a verification email; it
 * does *not* log the customer in — the contract returns the user, and the first session comes
 * from an explicit login, which is also where MFA policy first applies.
 */
@Injectable()
export class RegistrationService {
  constructor(
    @InjectModel(UserCredentialDoc.name) private readonly credentials: Model<UserCredentialDoc>,
    private readonly passwords: PasswordService,
    private readonly profiles: UserProfileReader,
    private readonly emailVerification: EmailVerificationService,
    private readonly audit: AuditPort,
  ) {}

  async register(request: RegisterRequest, device: DeviceContext): Promise<AuthenticatedUser> {
    this.passwords.assertNotBreached(request.password);

    const email = request.email.toLowerCase();
    if (await this.credentials.exists({ email })) {
      throw new ConflictError('An account with this email already exists', { email });
    }

    const credentialId = await this.createRecords(newId(), email, request);
    await this.emailVerification.issue(credentialId, email);
    await this.audit.record({
      actorId: credentialId,
      action: AUDIT_ACTIONS.Register,
      outcome: AUDIT_OUTCOMES.Success,
      ipAddress: device.ipAddress,
      userAgent: device.userAgent,
    });

    const credential = await this.credentials.findById(credentialId).lean();
    if (credential === null) {
      throw new ConflictError('The account could not be read back after creation', { email });
    }
    return this.profiles.toAuthenticatedUser(credential);
  }

  private async createRecords(
    customerId: string,
    email: string,
    request: RegisterRequest,
  ): Promise<string> {
    const credentialId = newId();
    await this.profiles.createCustomerRecord(customerId, email, request);
    await this.credentials.create([
      {
        _id: credentialId,
        customerId,
        email,
        passwordHash: await this.passwords.hash(request.password),
        emailVerified: false,
        roles: [],
        active: true,
      },
    ]);
    return credentialId;
  }
}
