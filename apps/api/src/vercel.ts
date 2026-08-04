// Must stay first: auto-instrumentations only hook libraries loaded after them.
import './instrumentation.js';
import 'reflect-metadata';

import type { IncomingMessage, ServerResponse } from 'node:http';

import type { FastifyInstance } from 'fastify';

import { createConfiguredApp } from './bootstrap.js';

let requestHandler:
  | ((request: IncomingMessage, response: ServerResponse<IncomingMessage>) => void)
  | undefined;
let bootPromise: Promise<void> | undefined;

async function ensureBootstrapped(): Promise<void> {
  if (requestHandler !== undefined) {
    return;
  }
  if (bootPromise !== undefined) {
    await bootPromise;
    return;
  }

  bootPromise = (async () => {
    const app = await createConfiguredApp({ enableShutdownHooks: false });
    await app.init();
    const fastify: FastifyInstance = app.getHttpAdapter().getInstance();
    await fastify.ready();
    requestHandler = (request, response) => {
      fastify.server.emit('request', request, response);
    };
  })();

  await bootPromise;
}

export default async function handler(
  request: IncomingMessage,
  response: ServerResponse<IncomingMessage>,
): Promise<void> {
  await ensureBootstrapped();
  if (requestHandler === undefined) {
    throw new Error('API bootstrap completed without a request handler');
  }
  requestHandler(request, response);
}
