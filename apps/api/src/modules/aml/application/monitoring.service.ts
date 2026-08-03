import type { AmlAlert } from '@icb/contracts';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { NotFoundError } from '../../../common/errors/index.js';
import { CustomerDoc } from '../../customers/infrastructure/customer.schemas.js';
import { customerDisplayName } from '../../kyc/infrastructure/customer-profile.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { detectThresholdAggregation } from '../domain/ctr-aggregation.js';
import type { FlowPoint, ScenarioHit } from '../domain/scenario.types.js';
import {
  detectHighRiskCorridor,
  detectRapidMovement,
  detectRoundAmounts,
  detectStructuring,
} from '../domain/scenarios.js';
import { AmlAlertsService } from './aml-alerts.service.js';
import { MonitoringContextService } from './monitoring-context.service.js';

/** Every behavioural detector, run in a fixed order so a scan's output is deterministic. */
const DETECTORS: readonly ((flows: readonly FlowPoint[], now: Date) => ScenarioHit | null)[] = [
  detectStructuring,
  detectRapidMovement,
  detectRoundAmounts,
  (flows) => detectHighRiskCorridor(flows),
  (flows) => detectThresholdAggregation(flows),
];

/**
 * Transaction monitoring.
 *
 * One scan reads the customer's recent flows once and offers them to every detector. Detectors
 * do not know about each other and the service does not rank them: each fired scenario becomes
 * its own alert (subject to the queue's one-open-alert-per-kind rule), because an analyst
 * closing "structuring" should never silently close "high-risk corridor" with it.
 *
 * Runs on demand here; the EOD batch (simulation track) calls `scanCustomer` for active
 * customers so the programme runs nightly without a human.
 */
@Injectable()
export class AmlMonitoringService {
  constructor(
    @InjectModel(CustomerDoc.name) private readonly customers: Model<CustomerDoc>,
    private readonly context: MonitoringContextService,
    private readonly alerts: AmlAlertsService,
    private readonly clock: ClockService,
  ) {}

  /** Scan one customer's recent history; returns the alerts actually raised (deduped). */
  async scanCustomer(customerId: string): Promise<AmlAlert[]> {
    const customer = await this.customers.findById(customerId).lean();
    if (!customer) {
      throw new NotFoundError('Customer', customerId);
    }

    const flows = await this.context.flowsFor(customerId);
    if (flows.length === 0) {
      return [];
    }

    const now = this.clock.now();
    const customerName = customerDisplayName(customer);
    const raised: AmlAlert[] = [];
    for (const detect of DETECTORS) {
      const hit = detect(flows, now);
      if (hit) {
        const alert = await this.alerts.raise({ customerId, customerName, hit });
        if (alert) {
          raised.push(alert);
        }
      }
    }
    return raised;
  }
}
