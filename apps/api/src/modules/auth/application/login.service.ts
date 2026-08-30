import type { LoginRequest } from '@icb/contracts';
import { Injectable } from '@nestjs/common';

import { AUDIT_ACTIONS } from '../auth.constants.js';
import { AUDIT_OUTCOMES, AuditPort } from './audit.port.js';
import type { DeviceContext, IssuedSession } from './auth.types.js';
import { CredentialVerifier } from './credential-verifier.service.js';
import { SessionIssuer } from './session-issuer.service.js';

/**
 * The login path: verify the password (with lockout), then issue a session that names the
 * browser and IP the login came from.
 */
@Injectable()
export class LoginService {
  constructor(
    private readonly verifier: CredentialVerifier,
    private readonly sessionIssuer: SessionIssuer,
    private readonly audit: AuditPort,
  ) {}

  async login(request: LoginRequest, device: DeviceContext): Promise<IssuedSession> {
    const credential = await this.verifier.verify(request.email, request.password);
    const context: DeviceContext = { ...device, deviceId: request.deviceId ?? device.deviceId };

    const session = await this.sessionIssuer.issue(credential._id, context);
    await this.audit.record({
      actorId: credential._id,
      action: AUDIT_ACTIONS.Login,
      outcome: AUDIT_OUTCOMES.Success,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
    return session;
  }
}
