import { moneySchema, type MoneyDto } from '@icb/contracts';
import { getScale, isCurrencyCode } from '@icb/money';
import { z } from 'zod';

import { DISPUTE_EVENT_TYPES, type DisputeEventType } from '../disputes.constants.js';

/** The slice of a dispute the watcher reasons about — deliberately decoupled from the Mongoose doc. */
export interface DisputeTimelineEntry {
  readonly at: Date;
  readonly stage: string;
  readonly note: string;
}

export interface DisputeSnapshot {
  readonly id: string;
  readonly reference: string;
  readonly customerId: string;
  readonly stage: string;
  readonly amountMinorUnits: number;
  readonly currency: string;
  readonly timeline: readonly DisputeTimelineEntry[];
  readonly slaDueAt: Date;
  readonly resolvedAt: Date | null;
}

/** How much of one dispute has already been announced. */
export interface WatchWatermark {
  readonly seenTimelineEntries: number;
  readonly slaAlerted: boolean;
}

export interface DisputeEvent {
  readonly type: DisputeEventType;
  readonly payload: Record<string, unknown>;
}

export interface WatchDecision {
  readonly events: readonly DisputeEvent[];
  readonly next: WatchWatermark;
}

/** Payload carried by `dispute.stage_changed`; parsed again at the consumer boundary. */
export const stageChangedPayloadSchema = z.object({
  disputeId: z.string(),
  reference: z.string(),
  customerId: z.string(),
  stage: z.string(),
  note: z.string(),
  occurredAt: z.string(),
  amount: moneySchema.optional(),
});
export type StageChangedPayload = z.infer<typeof stageChangedPayloadSchema>;

/** Payload carried by `dispute.sla_breached`. */
export const slaBreachedPayloadSchema = z.object({
  disputeId: z.string(),
  reference: z.string(),
  customerId: z.string(),
  stage: z.string(),
  slaDueAt: z.string(),
  amount: moneySchema.optional(),
});
export type SlaBreachedPayload = z.infer<typeof slaBreachedPayloadSchema>;

/**
 * What changed since the last sweep, for one dispute.
 *
 * A dispute seen for the first time announces only its current stage, not its whole history: the
 * watcher may be adopted against disputes raised before it existed, and replaying every entry
 * would bury the customer in stale mail. From then on each new timeline entry is one event,
 * because the timeline is append-only a count is a sufficient cursor. The SLA breach fires once,
 * only while the dispute is still open — a resolved dispute has no deadline left to miss.
 */
export function detectChanges(
  dispute: DisputeSnapshot,
  watermark: WatchWatermark | null,
  now: Date,
): WatchDecision {
  const unseen = watermark === null
    ? dispute.timeline.slice(-1)
    : dispute.timeline.slice(watermark.seenTimelineEntries);

  const events: DisputeEvent[] = unseen.map((entry) => stageChangedEvent(dispute, entry));

  const alreadyAlerted = watermark?.slaAlerted ?? false;
  const breached = dispute.resolvedAt === null && dispute.slaDueAt.getTime() < now.getTime();
  const slaAlerted = alreadyAlerted || breached;
  if (breached && !alreadyAlerted) {
    events.push(slaBreachedEvent(dispute));
  }

  return {
    events,
    next: { seenTimelineEntries: dispute.timeline.length, slaAlerted },
  };
}

function stageChangedEvent(dispute: DisputeSnapshot, entry: DisputeTimelineEntry): DisputeEvent {
  const payload: StageChangedPayload = {
    disputeId: dispute.id,
    reference: dispute.reference,
    customerId: dispute.customerId,
    stage: entry.stage,
    note: entry.note,
    occurredAt: entry.at.toISOString(),
    ...amountOf(dispute),
  };
  return { type: DISPUTE_EVENT_TYPES.StageChanged, payload };
}

function slaBreachedEvent(dispute: DisputeSnapshot): DisputeEvent {
  const payload: SlaBreachedPayload = {
    disputeId: dispute.id,
    reference: dispute.reference,
    customerId: dispute.customerId,
    stage: dispute.stage,
    slaDueAt: dispute.slaDueAt.toISOString(),
    ...amountOf(dispute),
  };
  return { type: DISPUTE_EVENT_TYPES.SlaBreached, payload };
}

/** The disputed value as a wire-ready DTO; omitted rather than guessed if the currency is unknown. */
function amountOf(dispute: DisputeSnapshot): { amount?: MoneyDto } {
  if (!isCurrencyCode(dispute.currency)) {
    return {};
  }
  return {
    amount: {
      minorUnits: dispute.amountMinorUnits,
      currency: dispute.currency,
      scale: getScale(dispute.currency),
    },
  };
}
