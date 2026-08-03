import { Injectable, Logger } from '@nestjs/common';

import { maskPhone } from '../domain/phone-mask.js';

/**
 * The simulated SMS rail (N2: no real rails — nothing leaves the process).
 *
 * The code is logged so a developer or a test can complete the flow end to end; the destination
 * is masked even in logs, because a phone number is PII. A real adapter would implement this
 * same method against an SMS vendor and nothing above it would change.
 */
@Injectable()
export class SmsOtpSender {
  private readonly logger = new Logger(SmsOtpSender.name);

  sendOtp(phone: string, code: string): void {
    this.logger.log({ to: maskPhone(phone) }, `SMS OTP dispatched (simulated): ${code}`);
  }
}
