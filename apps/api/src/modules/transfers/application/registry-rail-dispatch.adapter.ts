import type { TransferRail } from '@icb/contracts';
import { Injectable } from '@nestjs/common';

import { RailRejectedError } from '../../../common/errors/index.js';
import { RailRegistry } from '../../../simulation/rails/rail.registry.js';
import type { RailSubmission } from '../../../simulation/rails/rail.types.js';
import type {
  RailDispatchOutcome,
  RailDispatchPort,
  RailEstimate,
} from './rail-dispatch.port.js';

/**
 * Binds the dispatch port to the simulated rail registry.
 *
 * Rejection becomes the domain error callers already handle (`RailRejectedError`), and the
 * estimate reuses the registry's own settlement arithmetic — delay, cut-off penalty, business
 * calendar — so the arrival shown in a quote is computed by the same code that will later
 * deliver it.
 */
@Injectable()
export class RegistryRailDispatchAdapter implements RailDispatchPort {
  constructor(private readonly registry: RailRegistry) {}

  async dispatch(rail: TransferRail, submission: RailSubmission): Promise<RailDispatchOutcome> {
    const result = await this.registry.dispatch(rail, submission);
    if (!result.accepted) {
      throw new RailRejectedError(rail, result.code, result.label);
    }
    return { railReference: result.railReference, settlesAt: result.settlesAt };
  }

  async estimate(rail: TransferRail, at: Date): Promise<RailEstimate> {
    const profile = await this.registry.profileFor(rail);
    const timing = this.registry.settlementFor(profile, at);
    return {
      settlesAt: timing.settlesAt,
      cutOffAt: cutOffInstant(profile.cutOffTime ?? null, at),
      pastCutOff: timing.pastCutOff,
    };
  }
}

/** Today's cut-off as an instant: the profile's `HH:mm` pinned onto the UTC date of `at`. */
function cutOffInstant(cutOff: string | null, at: Date): Date | null {
  if (cutOff === null) {
    return null;
  }
  const [hours = '0', minutes = '0'] = cutOff.split(':');
  const dayStart = Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate());
  return new Date(dayStart + (Number(hours) * 60 + Number(minutes)) * 60 * 1000);
}
