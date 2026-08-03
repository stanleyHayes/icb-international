import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { lastValueFrom, of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { AUDIT_ACTION_KEY } from '../../../common/decorators/audit-action.decorator.js';
import type { AccessTokenClaims } from '../../auth/application/token.service.js';
import { AuditInterceptor } from '../application/audit.interceptor.js';
import type { AuditService } from '../audit.service.js';

const STAFF: AccessTokenClaims = {
  sub: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
  customerId: null,
  email: 'ops@icb.example',
  roles: ['admin'],
  sessionId: 'session-1',
};

function auditedHandler(): object {
  const handler = (): void => {};
  Reflect.defineMetadata(AUDIT_ACTION_KEY, 'account.freeze', handler);
  return handler;
}

const plainHandler = (): void => {};

function httpContext(handler: object, request: Partial<FastifyRequest>): ExecutionContext {
  return {
    getType: () => 'http',
    getHandler: () => handler,
    getClass: () => Object,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function request(overrides: Record<string, unknown> = {}): Partial<FastifyRequest> {
  return {
    url: '/v1/accounts/01ARZ3NDEKTSV4RRFFQ69G5FB0/freeze?notify=true',
    params: { accountId: '01ARZ3NDEKTSV4RRFFQ69G5FB0' },
    headers: { 'x-correlation-id': 'corr-1' },
    body: { reason: 'fraud-suspected' },
    ip: 'client-host',
    user: STAFF,
    ...overrides,
  };
}

function setup() {
  const audit = { record: vi.fn().mockResolvedValue({}) };
  const interceptor = new AuditInterceptor(new Reflector(), audit as unknown as AuditService);
  return { audit, interceptor };
}

const handlerReturning = (body: unknown): CallHandler => ({ handle: () => of(body) });

describe('AuditInterceptor', () => {
  it('records an enriched event for a handler carrying @AuditAction', async () => {
    const { audit, interceptor } = setup();
    const response = { status: 'frozen' };
    const context = httpContext(auditedHandler(), request());

    const result = await lastValueFrom(interceptor.intercept(context, handlerReturning(response)));

    expect(result).toBe(response);
    expect(audit.record).toHaveBeenCalledWith({
      actor: { type: 'staff', id: STAFF.sub, label: STAFF.email },
      action: 'account.freeze',
      subject: { type: 'accounts', id: '01ARZ3NDEKTSV4RRFFQ69G5FB0' },
      before: { reason: 'fraud-suspected' },
      after: response,
      ipAddress: 'client-host',
      correlationId: 'corr-1',
    });
  });

  it('classifies a customer principal as a customer actor', async () => {
    const { audit, interceptor } = setup();
    const customer: AccessTokenClaims = { ...STAFF, customerId: STAFF.sub, roles: [] };
    const context = httpContext(auditedHandler(), request({ user: customer }));

    await lastValueFrom(interceptor.intercept(context, handlerReturning({})));

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ actor: { type: 'customer', id: STAFF.sub, label: STAFF.email } }),
    );
  });

  it('attributes public-route events to an anonymous system actor', async () => {
    const { audit, interceptor } = setup();
    const context = httpContext(auditedHandler(), request({ user: undefined }));

    await lastValueFrom(interceptor.intercept(context, handlerReturning({})));

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ actor: { type: 'system', id: null, label: 'anonymous' } }),
    );
  });

  it('passes through handlers without @AuditAction untouched', async () => {
    const { audit, interceptor } = setup();
    const context = httpContext(plainHandler, request());

    const result = await lastValueFrom(interceptor.intercept(context, handlerReturning('ok')));

    expect(result).toBe('ok');
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('does not fail the response when the audit write fails', async () => {
    const { audit, interceptor } = setup();
    audit.record.mockRejectedValueOnce(new Error('mongo down'));
    const context = httpContext(auditedHandler(), request());

    const result = await lastValueFrom(interceptor.intercept(context, handlerReturning('ok')));

    expect(result).toBe('ok');
  });
});
