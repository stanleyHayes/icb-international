import type { AmlAlert } from '@icb/contracts';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { NotFoundError } from '../../../common/errors/index.js';
import { CustomerDoc } from '../../customers/infrastructure/customer.schemas.js';
import { customerDisplayName } from '../../kyc/infrastructure/customer-profile.js';
import { screenName, type WatchlistKind } from '../../kyc/domain/watchlist.js';
import { screenAdverseMedia } from '../domain/adverse-media.js';
import type { ScenarioHit } from '../domain/scenario.types.js';
import { AmlAlertsService } from './aml-alerts.service.js';

/** Screening alert kinds follow the list they came from. */
const KIND_BY_LIST: Readonly<Record<WatchlistKind, 'sanctions_match' | 'pep_match'>> = {
  sanctions: 'sanctions_match',
  pep: 'pep_match',
};

/**
 * Name screening — customers and their counterparties.
 *
 * Matching itself lives with the kyc watchlist (one list, one matcher, one definition of "close
 * enough"); this service owns what a hit *means*: an alert on the queue, attached to our
 * customer even when the matched name is the person they are paying. There is no threshold at
 * which a fuzzy screening hit is silently ignored — a weak match is exactly the case a human
 * exists for.
 */
@Injectable()
export class AmlScreeningService {
  constructor(
    @InjectModel(CustomerDoc.name) private readonly customers: Model<CustomerDoc>,
    private readonly alerts: AmlAlertsService,
  ) {}

  /** Screen the bank's own customer, e.g. at onboarding review or after a list update. */
  async screenCustomer(customerId: string): Promise<AmlAlert[]> {
    const customer = await this.customers.findById(customerId).lean();
    if (!customer) {
      throw new NotFoundError('Customer', customerId);
    }
    const name = customerDisplayName(customer);
    return this.raiseHits(customerId, name, this.scan(name, 'the customer'));
  }

  /**
   * Screen someone the customer is paying or receiving from. The alert lands on *our* customer —
   * they are the account we can act on — with the counterparty named in the detail.
   */
  async screenCounterparty(customerId: string, counterpartyName: string): Promise<AmlAlert[]> {
    const customer = await this.customers.findById(customerId).lean();
    if (!customer) {
      throw new NotFoundError('Customer', customerId);
    }
    const hits = this.scan(counterpartyName, `counterparty "${counterpartyName}"`);
    return this.raiseHits(customerId, customerDisplayName(customer), hits);
  }

  private scan(name: string, subject: string): ScenarioHit[] {
    const hits: ScenarioHit[] = [];
    for (const list of ['sanctions', 'pep'] as const) {
      const match = screenName(name, list);
      if (match) {
        hits.push({
          kind: KIND_BY_LIST[list],
          matchDetail:
            `${subject} matched ${list} entry "${match.entry.name}" ` +
            `(${match.entry.programme}, ${match.entry.country}) at ${match.similarity.toFixed(2)} similarity`,
          matchScore: match.similarity,
          relatedTransactionIds: [],
          aggregateMinorUnits: null,
          currency: null,
        });
      }
    }

    const media = screenAdverseMedia(name);
    if (media) {
      hits.push({
        kind: 'adverse_media',
        matchDetail:
          `${subject} matched adverse-media subject "${media.entry.name}" ` +
          `(${media.entry.topic}, ${media.entry.source}) at ${media.similarity.toFixed(2)} similarity`,
        matchScore: media.similarity,
        relatedTransactionIds: [],
        aggregateMinorUnits: null,
        currency: null,
      });
    }
    return hits;
  }

  private async raiseHits(
    customerId: string,
    customerName: string,
    hits: readonly ScenarioHit[],
  ): Promise<AmlAlert[]> {
    const raised: AmlAlert[] = [];
    for (const hit of hits) {
      const alert = await this.alerts.raise({ customerId, customerName, hit });
      if (alert) {
        raised.push(alert);
      }
    }
    return raised;
  }
}
