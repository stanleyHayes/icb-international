import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { LOGIN_HISTORY_ACTIONS, LOGIN_HISTORY_LIMIT } from '../auth.constants.js';
import { SecurityEventDoc } from '../infrastructure/auth.schemas.js';

/** One sign-in event as the customer sees it on their security screen. */
export interface LoginHistoryEntry {
  id: string;
  /** The audit action, e.g. `auth.login` — the wire keeps the greppable name. */
  action: string;
  outcome: string;
  ipAddress: string | null;
  userAgent: string | null;
  occurredAt: string;
}

/**
 * The customer's own login history, read back out of the same append-only `security_events`
 * chain the login flow writes (N7). The screen has no store of its own: anything it shows is by
 * definition something the bank recorded, so the two can never disagree.
 */
@Injectable()
export class LoginHistoryService {
  constructor(
    @InjectModel(SecurityEventDoc.name) private readonly events: Model<SecurityEventDoc>,
  ) {}

  /** The most recent sign-in events for one principal, newest first. */
  async list(userId: string): Promise<LoginHistoryEntry[]> {
    const rows = await this.events
      .find({ actorId: userId, action: { $in: [...LOGIN_HISTORY_ACTIONS] } })
      .sort({ occurredAt: -1 })
      .limit(LOGIN_HISTORY_LIMIT)
      .lean();
    return rows.map((row) => ({
      id: row._id,
      action: row.action,
      outcome: row.outcome,
      ipAddress: row.ipAddress,
      userAgent: row.userAgent,
      occurredAt: row.occurredAt.toISOString(),
    }));
  }
}
