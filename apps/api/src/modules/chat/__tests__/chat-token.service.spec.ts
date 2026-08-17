import { JwtService } from '@nestjs/jwt';
import { describe, expect, it } from 'vitest';

import type { AppConfiguration } from '../../../config/configuration.js';
import { ChatTokenService } from '../application/chat-token.service.js';

const SECRET = 'chat-test-secret';

function setup() {
  const jwt = new JwtService({});
  const config = { jwt: { accessSecret: SECRET } } as AppConfiguration;
  return { jwt, service: new ChatTokenService(jwt, config) };
}

describe('ChatTokenService visitor tokens', () => {
  it('round-trips the conversation the token is bound to', async () => {
    const { service } = setup();

    const token = await service.issueVisitorToken('conv-1');

    await expect(service.verifyVisitorToken(token)).resolves.toMatchObject({
      typ: 'chat_visitor',
      conversationId: 'conv-1',
    });
  });

  it('rejects a token minted for another audience', async () => {
    const { jwt, service } = setup();
    const accessToken = await jwt.signAsync(
      { typ: 'access', sub: 'u-1' },
      { secret: SECRET, issuer: 'icb', audience: 'icb-clients' },
    );

    await expect(service.verifyVisitorToken(accessToken)).rejects.toThrow();
  });

  it('rejects an expired token', async () => {
    const { jwt, service } = setup();
    const expired = await jwt.signAsync(
      // eslint-disable-next-line no-restricted-syntax -- constructing an already-expired exp claim.
      { typ: 'chat_visitor', conversationId: 'conv-1', exp: Math.floor(Date.now() / 1000) - 10 },
      { secret: SECRET, issuer: 'icb', audience: 'icb-chat-visitor' },
    );

    await expect(service.verifyVisitorToken(expired)).rejects.toThrow();
  });
});

describe('ChatTokenService ws tickets', () => {
  it('round-trips a visitor ticket bound to a conversation', async () => {
    const { service } = setup();

    const ticket = await service.issueWsTicket({
      role: 'visitor',
      conversationId: 'conv-1',
      name: 'Amara',
    });

    await expect(service.verifyWsTicket(ticket)).resolves.toMatchObject({
      typ: 'chat_ws',
      role: 'visitor',
      conversationId: 'conv-1',
      name: 'Amara',
    });
  });

  it('round-trips an agent ticket carrying the staff identity', async () => {
    const { service } = setup();

    const ticket = await service.issueWsTicket({ role: 'agent', sub: 'staff-1', name: 'agent@icb.bank' });

    await expect(service.verifyWsTicket(ticket)).resolves.toMatchObject({
      typ: 'chat_ws',
      role: 'agent',
      sub: 'staff-1',
      name: 'agent@icb.bank',
    });
  });

  it('rejects a visitor token presented as a ws ticket', async () => {
    const { service } = setup();
    const visitorToken = await service.issueVisitorToken('conv-1');

    await expect(service.verifyWsTicket(visitorToken)).rejects.toThrow();
  });

  it('rejects an expired ticket', async () => {
    const { jwt, service } = setup();
    const expired = await jwt.signAsync(
      // eslint-disable-next-line no-restricted-syntax -- constructing an already-expired exp claim.
      { typ: 'chat_ws', role: 'agent', exp: Math.floor(Date.now() / 1000) - 10 },
      { secret: SECRET, issuer: 'icb', audience: 'icb-chat-ws' },
    );

    await expect(service.verifyWsTicket(expired)).rejects.toThrow();
  });
});
