import { createHash } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { newId } from '../../../infrastructure/database/identifier.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { AuditPort, type AuditEventInput } from '../application/audit.port.js';
import { AuditEventDoc } from './auth.schemas.js';

/**
 * The default audit store: append-only `audit_events`, hash-chained per N7.
 *
 * Each event's hash covers the previous event's hash, so deleting or editing history breaks the
 * chain verifiably. A failed append is logged, never rethrown: an audit-store hiccup must not
 * lock customers out of the bank — availability — and the error itself is the signal to page on.
 */
@Injectable()
export class MongoAuditStore extends AuditPort {
  private readonly logger = new Logger(MongoAuditStore.name);

  constructor(
    @InjectModel(AuditEventDoc.name) private readonly events: Model<AuditEventDoc>,
    private readonly clock: ClockService,
  ) {
    super();
  }

  async record(event: AuditEventInput): Promise<void> {
    try {
      await this.append(event);
    } catch (error) {
      this.logger.error(
        { err: error, action: event.action, actorId: event.actorId },
        'Audit event could not be appended',
      );
    }
  }

  private async append(event: AuditEventInput): Promise<void> {
    // ULID ordering is creation ordering, so the newest row is the head of the chain.
    const head = await this.events.findOne().sort({ _id: -1 }).select('hash').lean();
    const previousHash = head?.hash ?? null;
    const occurredAt = this.clock.now();
    const hash = createHash('sha256')
      .update(chainPayload(previousHash, event, occurredAt))
      .digest('hex');

    await this.events.create([
      {
        _id: newId(),
        actorId: event.actorId,
        action: event.action,
        outcome: event.outcome,
        context: event.context ?? {},
        ipAddress: event.ipAddress ?? null,
        userAgent: event.userAgent ?? null,
        previousHash,
        hash,
        occurredAt,
      },
    ]);
  }
}

/** Canonical serialisation: the chain only holds if verification hashes the identical bytes. */
function chainPayload(previousHash: string | null, event: AuditEventInput, at: Date): string {
  return JSON.stringify({
    previousHash,
    actorId: event.actorId,
    action: event.action,
    outcome: event.outcome,
    context: event.context ?? {},
    ipAddress: event.ipAddress ?? null,
    userAgent: event.userAgent ?? null,
    occurredAt: at.toISOString(),
  });
}
