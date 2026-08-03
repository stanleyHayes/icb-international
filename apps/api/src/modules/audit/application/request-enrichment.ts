import type { FastifyRequest } from 'fastify';

import { CORRELATION_ID_HEADER } from '../../../common/observability/correlation.constants.js';
import type { AccessTokenClaims } from '../../auth/application/token.service.js';
import { SYSTEM_CORRELATION_ID } from '../audit.constants.js';
import type { AuditActor, AuditActorType, AuditSubject } from '../domain/audit-event.js';

/** '/v1/<resource>/…' — index 1 is the resource once the version prefix is dropped. */
const RESOURCE_SEGMENT_INDEX = 1;

/**
 * Classifies the authenticated principal for the trail. A customer token carries `customerId`,
 * a staff token carries roles, and a public route carries neither — recorded as an anonymous
 * system actor rather than dropped, because an unaudited privileged action is worse than an
 * unattributed one.
 */
export function actorFromClaims(claims: AccessTokenClaims | undefined): AuditActor {
  if (claims === undefined) {
    return { type: 'system', id: null, label: 'anonymous' };
  }
  let type: AuditActorType = 'system';
  if (claims.customerId !== null) {
    type = 'customer';
  } else if (claims.roles.length > 0) {
    type = 'staff';
  }
  return { type, id: claims.sub, label: claims.email };
}

/**
 * Best-effort subject from the route itself: the resource is the first path segment after the
 * version prefix, and the id is the first route parameter named `id` or `…Id`. Handlers that
 * need a richer subject should call `AuditService.record()` directly.
 */
export function subjectFromRequest(request: FastifyRequest): AuditSubject {
  const segments = request.url.split('?')[0]?.split('/').filter(Boolean) ?? [];
  const type = segments[RESOURCE_SEGMENT_INDEX] ?? 'unknown';
  const params = (request.params ?? {}) as Record<string, string>;
  const idKey = Object.keys(params).find((key) => key === 'id' || key.endsWith('Id'));
  return { type, id: idKey === undefined ? null : (params[idKey] ?? null) };
}

export function correlationIdFrom(request: FastifyRequest): string {
  const header = request.headers[CORRELATION_ID_HEADER];
  return typeof header === 'string' && header.length > 0 ? header : SYSTEM_CORRELATION_ID;
}
