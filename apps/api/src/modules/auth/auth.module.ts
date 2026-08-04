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
import { MfaChallengeService } from './application/mfa-challenge.service.js';
import { MfaEnrolmentService } from './application/mfa-enrolment.service.js';
import { PasswordResetService } from './application/password-reset.service.js';
import { PasswordService } from './application/password.service.js';
import { RegistrationService } from './application/registration.service.js';
import { SessionIssuer } from './application/session-issuer.service.js';
import { SessionManagerService } from './application/session-manager.service.js';
import { SessionWriter } from './application/session-writer.js';
import { SmsOtpSender } from './application/sms-otp.sender.js';
import { StepUpService } from './application/step-up.service.js';
import { TokenService } from './application/token.service.js';
import { TotpService } from './application/totp.service.js';
import { TrustedDeviceService } from './application/trusted-device.service.js';
import { UserProfileReader } from './application/user-profile-reader.js';
import { AuthSecurityController } from './auth-security.controller.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import {
  SecurityEventDoc,
  SecurityEventSchema,
  MfaChallengeDoc,
  MfaChallengeSchema,
  TrustedDeviceDoc,
  TrustedDeviceSchema,
} from './infrastructure/auth.schemas.js';
import { MongoAuditStore } from './infrastructure/mongo-audit.store.js';
import { MfaController } from './mfa.controller.js';

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
      { name: MfaChallengeDoc.name, schema: MfaChallengeSchema },
      { name: TrustedDeviceDoc.name, schema: TrustedDeviceSchema },
      { name: SecurityEventDoc.name, schema: SecurityEventSchema },
    ]),
  ],
  controllers: [AuthController, AuthSecurityController, MfaController],
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
    MfaChallengeService,
    MfaEnrolmentService,
    PasswordResetService,
    PasswordService,
    RegistrationService,
    SessionIssuer,
    SessionManagerService,
    SessionWriter,
    SmsOtpSender,
    StepUpService,
    TokenService,
    TotpService,
    TrustedDeviceService,
    UserProfileReader,
  ],
  exports: [AuthService, AuditPort, PasswordService, TokenService, MongooseModule],
})
export class AuthModule {}
