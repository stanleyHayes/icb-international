import type { AuditEvent, OffsetPage } from '@icb/contracts';
import { Injectable } from '@nestjs/common';

import { DomainError } from '../../common/errors/index.js';
import { buildOffsetPage } from '../../common/pagination/offset.js';
import { newId } from '../../infrastructure/database/identifier.js';
import { ClockService } from '../../simulation/clock/clock.service.js';
import { MAX_APPEND_ATTEMPTS, MAX_EXPORT_ROWS, SYSTEM_CORRELATION_ID } from './audit.constants.js';
import type { AuditIntegrity, AuditQuery, RecordAuditInput } from './domain/audit-event.js';
import { isDuplicateKeyError } from './domain/audit-errors.js';
import { diffChanges, maskSnapshot } from './domain/diff.js';
import { computeEventHash } from './domain/hash-chain.js';
import { toAuditEvent } from './infrastructure/audit-event.mapper.js';
import type { AuditEventDoc } from './infrastructure/audit-event.schemas.js';
import { AuditEventRepository } from './infrastructure/audit-event.repository.js';

/**
 * The audit port (agent_plan.md N7) — the only write path into `audit_events`, exported from
 * `AuditModule` so any module can record privileged actions:
 *
 * ```ts
 * await this.audit.record({
 *   actor: { type: 'staff', id: staff.sub, label: staff.email },
 *   action: 'account.freeze',
 *   subject: { type: 'accounts', id: accountId },
 *   before: { status: 'active' },
 *   after: { status: 'frozen' },
 * });
 * ```
 *
 * Every append is hash-chained (`hash = H(prevHash ‖ canonical(event))`), PII-masked, and
 * stamped from the simulated clock. Callers never compute sequence or hashes themselves.
 */
@Injectable()
export class AuditService {
  constructor(
    private readonly events: AuditEventRepository,
    private readonly clock: ClockService,
  ) {}

  /** Append one event to the chain. Retries the sequence race, never rewrites an existing row. */
  async record(input: RecordAuditInput): Promise<AuditEvent> {
    const before = maskSnapshot(input.before);
    const after = maskSnapshot(input.after);
    const changes = diffChanges(before, after);
    for (let attempt = 1; attempt <= MAX_APPEND_ATTEMPTS; attempt += 1) {
      try {
        return await this.appendOnce(input, before, after, changes);
      } catch (error) {
        if (!isDuplicateKeyError(error) || attempt === MAX_APPEND_ATTEMPTS) {
          throw error;
        }
      }
    }
    throw new DomainError('INTERNAL_ERROR', 'An audit event could not be appended');
  }

  /** Offset-paged search for the admin console, newest first. */
  async search(query: AuditQuery): Promise<OffsetPage<AuditEvent>> {
    const { items, total } = await this.events.page(query);
    return buildOffsetPage(items.map(toAuditEvent), total, query);
  }

  /**
   * Re-walk the whole chain and recompute every hash. Reports the sequence of the first broken
   * link — the earliest row whose stored hash no longer matches its contents, or whose
   * `previousHash` no longer points at its predecessor.
   */
  async verifyIntegrity(): Promise<AuditIntegrity> {
    let previousHash: string | null = null;
    let checkedEvents = 0;
    let firstBrokenSequence: number | null = null;
    for await (const event of this.events.walkAll()) {
      const linkIntact = event.previousHash === previousHash;
      const hashIntact = computeEventHash(previousHash, event) === event.hash;
      if ((!linkIntact || !hashIntact) && firstBrokenSequence === null) {
        firstBrokenSequence = event.sequence;
      }
      previousHash = event.hash;
      checkedEvents += 1;
    }
    return {
      verified: firstBrokenSequence === null,
      checkedEvents,
      firstBrokenSequence,
      checkedAt: this.clock.now().toISOString(),
    };
  }

  /**
   * NDJSON export of a search result — one contract-shaped `AuditEvent` per line, in chain
   * order. Capped at `MAX_EXPORT_ROWS` so a careless query cannot stream the entire trail
   * through one HTTP response.
   */
  async exportEvents(query: AuditQuery): Promise<string> {
    const lines: string[] = [];
    for await (const event of this.events.walkQuery(query)) {
      lines.push(JSON.stringify(toAuditEvent(event)));
      if (lines.length >= MAX_EXPORT_ROWS) {
        break;
      }
    }
    return lines.length === 0 ? '' : `${lines.join('\n')}\n`;
  }

  private async appendOnce(
    input: RecordAuditInput,
    before: Record<string, unknown> | null,
    after: Record<string, unknown> | null,
    changes: AuditEventDoc['changes'],
  ): Promise<AuditEvent> {
    const head = await this.events.last();
    const previousHash = head?.hash ?? null;
    const unsigned: AuditEventDoc = {
      _id: newId(),
      sequence: (head?.sequence ?? -1) + 1,
      actorType: input.actor.type,
      actorId: input.actor.id,
      actorLabel: input.actor.label,
      action: input.action,
      subjectType: input.subject.type,
      subjectId: input.subject.id,
      summary: input.summary ?? input.action,
      before,
      after,
      changes,
      ipAddress: input.ipAddress ?? null,
      correlationId: input.correlationId ?? SYSTEM_CORRELATION_ID,
      previousHash,
      hash: '',
      at: this.clock.now(),
    };
    const event = { ...unsigned, hash: computeEventHash(previousHash, unsigned) };
    await this.events.insert(event);
    return toAuditEvent(event);
  }
}
