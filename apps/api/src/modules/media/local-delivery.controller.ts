import { Controller, Get, Req, Res } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { Public } from '../../common/decorators/public.decorator.js';
import { ValidationError } from '../../common/errors/index.js';
import { LocalDeliveryService } from './application/local-delivery.service.js';

const DOWNLOAD_QUERY_FLAG = '1';

interface DeliveryQuery {
  exp?: string;
  sig?: string;
  dl?: string;
}

/**
 * The offline stand-in for the storage provider's signed delivery URLs.
 *
 * The browser follows these links directly — an `<img>` tag, a "download statement" anchor —
 * so the route is public: the HMAC in the query string is the credential, exactly as it is
 * with the real provider's authenticated delivery type.
 */
@Controller('media')
export class LocalDeliveryController {
  constructor(private readonly delivery: LocalDeliveryService) {}

  @Public()
  @Get('delivery/*')
  async deliver(
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const path = (request.params as Record<string, string>)['*'] ?? '';
    const { exp, sig, dl } = request.query as DeliveryQuery;
    const expiresAtEpoch = Number(exp);
    if (!exp || !sig || !Number.isFinite(expiresAtEpoch)) {
      throw new ValidationError('The delivery link is incomplete', [
        { path: 'sig', message: 'A signed delivery link carries exp and sig' },
      ]);
    }

    const file = await this.delivery.open(path, expiresAtEpoch, sig);

    void reply
      .header('content-type', file.contentType)
      .header('content-length', String(file.sizeBytes))
      .header('cache-control', 'private, no-store');
    if (dl === DOWNLOAD_QUERY_FLAG) {
      void reply.header('content-disposition', `attachment; filename="${file.filename}"`);
    }
    await reply.send(file.stream);
  }
}
