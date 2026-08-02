import type { NotificationEvent, NotificationPreference } from '@icb/contracts';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { newId } from '../../../infrastructure/database/identifier.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import {
  DEFAULT_CHANNELS,
  DEFAULT_QUIET_HOURS,
  applyMandatoryFloor,
  defaultPreferences,
} from '../domain/preference-defaults.js';
import type {
  QuietHours,
  ResolvedPreferences,
  UpdatePreferencesRequest,
} from '../domain/preference.types.js';
import {
  NotificationPreferenceDoc,
  type PreferenceEntry,
} from '../infrastructure/notification-preference.schemas.js';
import { toPreference, toPreferenceEntry } from '../infrastructure/notification.mapper.js';

/**
 * The per-customer channel matrix.
 *
 * Stored rows are an *overlay* on the defaults, never a replacement. A customer who once changed
 * one row still picks up improved defaults for the fifteen they never touched, and an event
 * added to the contract tomorrow already has a sensible setting for everyone.
 */
@Injectable()
export class NotificationPreferencesService {
  constructor(
    @InjectModel(NotificationPreferenceDoc.name)
    private readonly documents: Model<NotificationPreferenceDoc>,
    private readonly clock: ClockService,
  ) {}

  /** The complete matrix as the customer should see it: defaults, overlay, mandatory floor. */
  async resolve(customerId: string): Promise<ResolvedPreferences> {
    const stored = await this.documents.findOne({ customerId }).lean();
    const overlay = new Map<string, PreferenceEntry>(
      (stored?.entries ?? []).map((entry) => [entry.event, entry]),
    );

    const preferences = defaultPreferences().map((fallback) => {
      const override = overlay.get(fallback.event);
      return applyMandatoryFloor(override === undefined ? fallback : toPreference(override));
    });

    return { preferences, quietHours: quietHoursOf(stored) };
  }

  /** The single row a delivery decision needs, without materialising the whole matrix. */
  async forEvent(
    customerId: string,
    event: NotificationEvent,
  ): Promise<{ preference: NotificationPreference; quietHours: QuietHours }> {
    const stored = await this.documents.findOne({ customerId }).lean();
    const override = (stored?.entries ?? []).find((entry) => entry.event === event);
    const preference =
      override === undefined ? { event, ...DEFAULT_CHANNELS[event] } : toPreference(override);

    return { preference: applyMandatoryFloor(preference), quietHours: quietHoursOf(stored) };
  }

  /**
   * Merge the submitted rows into the overlay.
   *
   * Merging rather than replacing means a client that sends only the switch the customer just
   * flipped cannot silently reset the other fifteen — a real failure mode for a settings screen
   * that renders one section at a time.
   */
  async update(
    customerId: string,
    request: UpdatePreferencesRequest,
  ): Promise<ResolvedPreferences> {
    const stored = await this.documents.findOne({ customerId }).lean();
    const merged = new Map<string, PreferenceEntry>(
      (stored?.entries ?? []).map((entry) => [entry.event, entry]),
    );
    for (const preference of request.preferences) {
      merged.set(preference.event, toPreferenceEntry(applyMandatoryFloor(preference)));
    }

    const quietHours = request.quietHours ?? quietHoursOf(stored);
    const now = this.clock.now();

    await this.documents.updateOne(
      { customerId },
      {
        $set: {
          entries: [...merged.values()],
          quietHoursEnabled: quietHours.enabled,
          quietHoursFrom: quietHours.from,
          quietHoursTo: quietHours.to,
          updatedAtUtc: now,
        },
        $setOnInsert: { _id: newId(), customerId },
      },
      { upsert: true },
    );

    return this.resolve(customerId);
  }
}

function quietHoursOf(stored: Pick<
  NotificationPreferenceDoc,
  'quietHoursEnabled' | 'quietHoursFrom' | 'quietHoursTo'
> | null): QuietHours {
  if (stored === null) {
    return DEFAULT_QUIET_HOURS;
  }
  return {
    enabled: stored.quietHoursEnabled,
    from: stored.quietHoursFrom,
    to: stored.quietHoursTo,
  };
}
