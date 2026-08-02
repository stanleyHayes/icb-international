import type { Buffer } from 'node:buffer';

import { Controller, Headers, HttpCode, Post, Req } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { Public } from '../../../common/decorators/public.decorator.js';
import { ResendWebhookService, type WebhookOutcome } from './resend-webhook.service.js';

/**
 * Nest populates `rawBody` only when the application is created with `rawBody: true`. Typed as
 * optional here so this controller reads the exact signed bytes when they are available and
 * degrades honestly when they are not.
 */
type RawBodyRequest = FastifyRequest & { rawBody?: Buffer | string };

type HeaderBag = Record<string, string | string[] | undefined>;

/**
 * `POST /webhooks/resend` — the one endpoint in this module the internet can reach.
 *
 * `@Public()` because Resend has no ICB token; the signature *is* the authentication, verified
 * in the service before anything is read from the body. It always answers 200 for a payload it
 * understood, including ones it chose not to act on: a 4xx makes Resend retry an event that will
 * never apply, forever.
 */
@Controller('webhooks/resend')
export class ResendWebhookController {
  constructor(private readonly webhooks: ResendWebhookService) {}

  @Public()
  @Post()
  @HttpCode(200)
  async receive(
    @Req() request: RawBodyRequest,
    @Headers() headers: HeaderBag,
  ): Promise<WebhookOutcome> {
    return this.webhooks.receive({
      payload: rawPayload(request),
      headers: {
        id: header(headers, 'webhook-id', 'svix-id'),
        timestamp: header(headers, 'webhook-timestamp', 'svix-timestamp'),
        signature: header(headers, 'webhook-signature', 'svix-signature'),
      },
    });
  }
}

/**
 * The bytes the signature covers.
 *
 * `rawBody` is exact and is used whenever the host application enables it. The fallback
 * re-serialises the parsed body, which reproduces Resend's compact JSON in practice but is not
 * guaranteed byte-for-byte — so a deployment that verifies signatures should turn `rawBody` on.
 */
function rawPayload(request: RawBodyRequest): string {
  const raw = request.rawBody;
  if (typeof raw === 'string') {
    return raw;
  }
  if (raw !== undefined) {
    return raw.toString('utf8');
  }
  return JSON.stringify(request.body ?? {});
}

/** Standard Webhooks renamed its headers from the `svix-` prefix; both spellings are accepted. */
function header(headers: HeaderBag, primary: string, fallback: string): string | null {
  const value = headers[primary] ?? headers[fallback];
  if (typeof value === 'string') {
    return value;
  }
  return Array.isArray(value) ? (value[0] ?? null) : null;
}
