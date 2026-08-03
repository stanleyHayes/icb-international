import { Logger } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SmsOtpSender } from './sms-otp.sender.js';

describe('SmsOtpSender', () => {
  afterEach(() => vi.restoreAllMocks());

  it('logs the code against a masked destination — never the raw number', () => {
    const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

    new SmsOtpSender().sendOtp('+233244124521', '483920');

    const [meta, message] = log.mock.calls[0] as [{ to: string }, string];
    expect(meta.to).toBe('+233 ** *** 4521');
    expect(message).toContain('483920');
  });
});
