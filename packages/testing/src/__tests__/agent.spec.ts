import { createServer, type Server } from 'node:http';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createAuthenticatedAgent } from '../auth/agent.js';

const TOKEN = 'header.payload.signature';
const IDEMPOTENCY_KEY = 'test-key-00000001';

interface CapturedRequest {
  method: string;
  authorization: string | undefined;
  idempotencyKey: string | undefined;
}

let server: Server;
let baseUrl: string;
let lastRequest: CapturedRequest;

beforeAll(async () => {
  server = createServer((req, res) => {
    lastRequest = {
      method: req.method ?? '',
      authorization: req.headers.authorization,
      idempotencyKey: req.headers['idempotency-key'] as string | undefined,
    };
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end('{}');
  });
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (address == null || typeof address === 'string') {
    throw new Error('test server failed to bind');
  }
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

function agent(idempotencyKey?: string) {
  const provider = { getHttpServer: () => baseUrl };
  return idempotencyKey == null
    ? createAuthenticatedAgent({ app: provider, token: TOKEN })
    : createAuthenticatedAgent({ app: provider, token: TOKEN, idempotencyKey });
}

describe('createAuthenticatedAgent', () => {
  it('sends the bearer token on reads', async () => {
    await agent().get('/v1/accounts').expect(200);
    expect(lastRequest.authorization).toBe(`Bearer ${TOKEN}`);
    expect(lastRequest.method).toBe('GET');
  });

  it('sends the idempotency key on mutations when configured', async () => {
    await agent(IDEMPOTENCY_KEY).post('/v1/transfers').send({}).expect(200);
    expect(lastRequest.idempotencyKey).toBe(IDEMPOTENCY_KEY);
    expect(lastRequest.method).toBe('POST');
  });

  it('omits the idempotency key on reads', async () => {
    await agent(IDEMPOTENCY_KEY).get('/v1/accounts').expect(200);
    expect(lastRequest.idempotencyKey).toBeUndefined();
  });

  it('omits the idempotency key when not configured', async () => {
    await agent().patch('/v1/accounts/x').send({}).expect(200);
    expect(lastRequest.idempotencyKey).toBeUndefined();
    expect(lastRequest.authorization).toBe(`Bearer ${TOKEN}`);
  });
});
