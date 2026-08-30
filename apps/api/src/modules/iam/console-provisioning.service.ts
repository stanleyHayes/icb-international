import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { newId } from '../../infrastructure/database/identifier.js';
import { PasswordService } from '../auth/application/password.service.js';
import { UserCredentialDoc } from '../customers/infrastructure/customer.schemas.js';

import { CONSOLE_ACCOUNTS, type ConsoleAccount } from './console-accounts.js';
import { StaffUserDoc } from './infrastructure/iam.schemas.js';

export interface ProvisionedAccount {
  readonly email: string;
  readonly roles: readonly string[];
  readonly credentialCreated: boolean;
  readonly staffCreated: boolean;
}

/**
 * Creates the standing operations-console sign-ins.
 *
 * Both collections are written, and that is the whole point of this service rather than a call to
 * `StaffService.createStaff`. A staff row carries profile, roles and policy flags but no password,
 * so an account created through the admin endpoint alone cannot sign in at all; the token is built
 * from `user_credentials.roles` in `session-issuer.service.ts`, so an account created only in
 * `user_credentials` signs in but never appears in the staff directory. An operator needs both, and
 * they need to agree.
 *
 * Every write is an idempotent upsert keyed on the address, so a second run rotates the password
 * and re-applies the roles instead of failing on a duplicate key. That is what makes this safe to
 * point at an environment that already has these accounts.
 */
@Injectable()
export class ConsoleProvisioningService {
  private readonly logger = new Logger(ConsoleProvisioningService.name);

  constructor(
    @InjectModel(UserCredentialDoc.name)
    private readonly credentials: Model<UserCredentialDoc>,
    @InjectModel(StaffUserDoc.name) private readonly staff: Model<StaffUserDoc>,
    private readonly passwords: PasswordService,
  ) {}

  async provisionAll(password: string): Promise<ProvisionedAccount[]> {
    const results: ProvisionedAccount[] = [];
    for (const account of CONSOLE_ACCOUNTS) {
      results.push(await this.provision(account, password));
    }
    return results;
  }

  private async provision(account: ConsoleAccount, password: string): Promise<ProvisionedAccount> {
    const email = account.email.toLowerCase();
    const roles = [...account.roles];
    const passwordHash = await this.passwords.hash(password);

    const credential = await this.credentials.updateOne(
      { email },
      {
        // Roles and password are re-applied on every run so a rotation actually takes effect.
        $set: { passwordHash, roles, active: true, emailVerified: true },
        $setOnInsert: { _id: newId(), customerId: null, email },
      },
      { upsert: true },
    );

    const staff = await this.staff.updateOne(
      { email },
      {
        $set: { roles, active: true },
        // Names are initial values: an operator who has since renamed the account should not
        // have that undone by a re-run.
        $setOnInsert: {
          _id: newId(),
          email,
          firstName: account.firstName,
          lastName: account.lastName,
          lastLoginAt: null,
        },
      },
      { upsert: true },
    );

    const provisioned: ProvisionedAccount = {
      email,
      roles,
      credentialCreated: credential.upsertedCount > 0,
      staffCreated: staff.upsertedCount > 0,
    };
    this.logger.log(
      { email, roles: roles.length, created: provisioned.credentialCreated },
      'Console account provisioned',
    );
    return provisioned;
  }
}
