import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';

import {
  CustomerDoc,
  CustomerSchema,
  SessionDoc,
  SessionSchema,
  UserCredentialDoc,
  UserCredentialSchema,
} from '../customers/infrastructure/customer.schemas.js';
import { PasswordService } from './application/password.service.js';
import { SessionWriter } from './application/session-writer.js';
import { TokenService } from './application/token.service.js';
import { UserProfileReader } from './application/user-profile-reader.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

/**
 * Global because JwtAuthGuard — registered application-wide — needs TokenService, and every
 * module that reads the current principal depends on the same claim shape.
 */
@Global()
@Module({
  imports: [
    JwtModule.register({}),
    MongooseModule.forFeature([
      { name: UserCredentialDoc.name, schema: UserCredentialSchema },
      { name: CustomerDoc.name, schema: CustomerSchema },
      { name: SessionDoc.name, schema: SessionSchema },
    ]),
  ],
  controllers: [AuthController],
  providers: [AuthService, PasswordService, SessionWriter, TokenService, UserProfileReader],
  exports: [AuthService, PasswordService, TokenService, MongooseModule],
})
export class AuthModule {}
