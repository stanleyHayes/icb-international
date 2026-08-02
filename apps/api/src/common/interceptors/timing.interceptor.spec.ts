import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { TimingInterceptor } from './timing.interceptor.js';

function contextWith(reply: { header: ReturnType<typeof vi.fn> }): ExecutionContext {
  return {
    switchToHttp: () => ({ getResponse: () => reply }),
  } as unknown as ExecutionContext;
}

describe('TimingInterceptor', () => {
  it('sets a Server-Timing header with the handler duration', async () => {
    const reply = { header: vi.fn() };
    const handler: CallHandler = { handle: () => of('done') };

    const result = new TimingInterceptor().intercept(contextWith(reply), handler);
    await expect(firstValueFrom(result)).resolves.toBe('done');

    const [name, value] = reply.header.mock.calls[0] as [string, string];
    expect(name).toBe('server-timing');
    expect(value).toMatch(/^app;dur=\d+(\.\d+)?$/);
  });
});
