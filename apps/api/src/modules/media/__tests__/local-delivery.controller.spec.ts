import type { FastifyReply, FastifyRequest } from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ValidationError } from '../../../common/errors/index.js';
import type {
  LocalDeliveryFile,
  LocalDeliveryService,
} from '../application/local-delivery.service.js';
import { LocalDeliveryController } from '../local-delivery.controller.js';

const DELIVERY_PATH = 'icb/statements/statement-a1b2.pdf';
const FILE = {
  stream: { id: 'fake-stream' },
  contentType: 'application/pdf',
  sizeBytes: 42,
  filename: 'statement-a1b2.pdf',
} as unknown as LocalDeliveryFile;

interface FakeReply {
  reply: FastifyReply;
  headers: Map<string, string>;
  send: ReturnType<typeof vi.fn>;
}

function fakeReply(): FakeReply {
  const headers = new Map<string, string>();
  const send = vi.fn().mockResolvedValue(undefined);
  const reply = {
    header(name: string, value: string) {
      headers.set(name, value);
      return reply;
    },
    send,
  } as unknown as FastifyReply;
  return { reply, headers, send };
}

function request(
  params: Record<string, string>,
  query: Record<string, string>,
): FastifyRequest {
  return { params, query } as unknown as FastifyRequest;
}

describe('LocalDeliveryController', () => {
  let open: ReturnType<typeof vi.fn>;
  let controller: LocalDeliveryController;

  beforeEach(() => {
    open = vi.fn().mockResolvedValue(FILE);
    controller = new LocalDeliveryController({ open } as unknown as LocalDeliveryService);
  });

  it('streams the opened file with private, no-store headers', async () => {
    const { reply, headers, send } = fakeReply();

    await controller.deliver(
      request({ '*': DELIVERY_PATH }, { exp: '4000000000', sig: 'abc123' }),
      reply,
    );

    expect(open).toHaveBeenCalledWith(DELIVERY_PATH, 4_000_000_000, 'abc123');
    expect(headers.get('content-type')).toBe('application/pdf');
    expect(headers.get('content-length')).toBe('42');
    expect(headers.get('cache-control')).toBe('private, no-store');
    expect(send).toHaveBeenCalledWith(FILE.stream);
  });

  it('adds a content-disposition attachment header only when dl=1', async () => {
    const withDownload = fakeReply();
    await controller.deliver(
      request({ '*': DELIVERY_PATH }, { exp: '4000000000', sig: 'abc123', dl: '1' }),
      withDownload.reply,
    );
    expect(withDownload.headers.get('content-disposition')).toBe(
      'attachment; filename="statement-a1b2.pdf"',
    );

    const inline = fakeReply();
    await controller.deliver(
      request({ '*': DELIVERY_PATH }, { exp: '4000000000', sig: 'abc123', dl: '0' }),
      inline.reply,
    );
    expect(inline.headers.has('content-disposition')).toBe(false);
  });

  it('rejects a link without exp before touching the delivery service', async () => {
    const { reply } = fakeReply();

    await expect(
      controller.deliver(request({ '*': DELIVERY_PATH }, { sig: 'abc123' }), reply),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(open).not.toHaveBeenCalled();
  });

  it('rejects a link without sig', async () => {
    const { reply } = fakeReply();

    await expect(
      controller.deliver(request({ '*': DELIVERY_PATH }, { exp: '4000000000' }), reply),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(open).not.toHaveBeenCalled();
  });

  it('rejects a non-numeric exp', async () => {
    const { reply } = fakeReply();

    await expect(
      controller.deliver(
        request({ '*': DELIVERY_PATH }, { exp: 'tomorrow', sig: 'abc123' }),
        reply,
      ),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(open).not.toHaveBeenCalled();
  });

  it('treats a missing wildcard parameter as the empty path', async () => {
    const { reply } = fakeReply();

    await controller.deliver(request({}, { exp: '4000000000', sig: 'abc123' }), reply);

    expect(open).toHaveBeenCalledWith('', 4_000_000_000, 'abc123');
  });
});
