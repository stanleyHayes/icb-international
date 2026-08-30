import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';

import { FieldEncryptionService } from '../../common/crypto/field-encryption.service.js';
import {
  CustomerDoc,
  CustomerSchema,
  SessionDoc,
  SessionSchema,
  UserCredentialDoc,
  UserCredentialSchema,
} from '../customers/infrastructure/customer.schemas.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { AuthMailerService } from './application/auth-mailer.service.js';
import { AuditPort } from './application/audit.port.js';
import { ChangePasswordService } from './application/change-password.service.js';
import { CredentialVerifier } from './application/credential-verifier.service.js';
import { EmailVerificationService } from './application/email-verification.service.js';
import { LoginHistoryService } from './application/login-history.service.js';
import { LoginService } from './application/login.service.js';
import { PasswordResetService } from './application/password-reset.service.js';
import { PasswordService } from './application/password.service.js';
import { RegistrationService } from './application/registration.service.js';
import { SessionIssuer } from './application/session-issuer.service.js';
import { SessionManagerService } from './application/session-manager.service.js';
import { SessionWriter } from './application/session-writer.js';
import { TokenService } from './application/token.service.js';
import { UserProfileReader } from './application/user-profile-reader.js';
import { AuthSecurityController } from './auth-security.controller.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { SecurityEventDoc, SecurityEventSchema } from './infrastructure/auth.schemas.js';
import { MongoAuditStore } from './infrastructure/mongo-audit.store.js';

/**
 * Global because JwtAuthGuard — registered application-wide — needs TokenService, and every
 * module that reads the current principal depends on the same claim shape.
 *
 * `AuditPort` is exported for every module that must append to the audit trail (N7); today it
 * binds the Mongo hash-chained store, and a future dedicated audit module can rebind it without
 * touching any emitter.
 */
@Global()
@Module({
  imports: [
    JwtModule.register({}),
    NotificationsModule,
    MongooseModule.forFeature([
      { name: UserCredentialDoc.name, schema: UserCredentialSchema },
      { name: CustomerDoc.name, schema: CustomerSchema },
      { name: SessionDoc.name, schema: SessionSchema },
      { name: SecurityEventDoc.name, schema: SecurityEventSchema },
    ]),
  ],
  controllers: [AuthController, AuthSecurityController],
  providers: [
    { provide: AuditPort, useClass: MongoAuditStore },
    AuthService,
    AuthMailerService,
    ChangePasswordService,
    CredentialVerifier,
    EmailVerificationService,
    FieldEncryptionService,
    LoginHistoryService,
    LoginService,
    PasswordResetService,
    PasswordService,
    RegistrationService,
    SessionIssuer,
    SessionManagerService,
    SessionWriter,
    TokenService,
    UserProfileReader,
  ],
  exports: [AuthService, AuditPort, PasswordService, TokenService, MongooseModule],
})
export class AuthModule {}
