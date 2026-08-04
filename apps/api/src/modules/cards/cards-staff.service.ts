import type {
  CardAuthorisation,
  CardDetail,
  CardSummary,
  CursorPage,
  IssueCardRequest,
  ReissueCardRequest,
} from '@icb/contracts';
import { Injectable } from '@nestjs/common';

import { CardCaptureService } from './application/card-capture.service.js';
import { CardIssuanceService } from './application/card-issuance.service.js';
import { CardReader, type CardQuery } from './application/card-reader.js';
import { CardSecurityService } from './application/card-security.service.js';
import { CardSettingsService, type UpdateLimitsRequest } from './application/card-settings.service.js';
import { CardsService } from './cards.service.js';

/**
 * The staff console's card operations.
 *
 * Nothing here re-implements card logic: each operation is the customer-facing rule with the
 * ownership scope lifted, delegated to the service that already owns that rule. The staff-facing
 * additions — resolving the customer from the account rather than trusting the client, recording
 * *who* blocked a card — live in those services next to the rule they extend, not here.
 */
@Injectable()
export class CardsStaffService {
  constructor(
    private readonly reader: CardReader,
    private readonly issuance: CardIssuanceService,
    private readonly lifecycle: CardsService,
    private readonly security: CardSecurityService,
    private readonly settings: CardSettingsService,
    private readonly capture: CardCaptureService,
  ) {}

  async list(query: CardQuery): Promise<CursorPage<CardSummary>> {
    return this.reader.listAll(query);
  }

  async detail(cardId: string): Promise<CardDetail> {
    return this.reader.detail(await this.reader.loadById(cardId));
  }

  /** Issue against any account. The owning customer is resolved server-side from the account. */
  async issue(request: IssueCardRequest): Promise<CardDetail> {
    return this.issuance.issueAsStaff(request);
  }

  /** A freeze the customer cannot lift, stamped with the staff member who placed it. */
  async block(cardId: string, reason: string, actorId: string): Promise<CardDetail> {
    return this.lifecycle.blockAsStaff(cardId, reason, actorId);
  }

  /** Retire the PAN and mint a replacement linked by `replacedCardId` — always, on a staff report. */
  async reissue(cardId: string, request: ReissueCardRequest): Promise<CardDetail> {
    return this.lifecycle.reportAsStaff(cardId, { ...request, reissue: true });
  }

  /** Clear the PIN so the customer sets a new one themselves. Staff never see or choose a PIN. */
  async resetPin(cardId: string): Promise<CardDetail> {
    return this.security.clearPin(cardId);
  }

  async updateLimits(cardId: string, request: UpdateLimitsRequest): Promise<CardDetail> {
    return this.settings.updateLimitsAsStaff(cardId, request);
  }

  /** Release an open hold before its window closes; the authorisation is left `expired`. */
  async expireAuthorisation(
    cardId: string,
    authorisationId: string,
    reason: string,
  ): Promise<CardAuthorisation> {
    return this.capture.expireForCard(cardId, authorisationId, reason);
  }
}
