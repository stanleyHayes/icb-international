import type { CardDetail, CardKind, CardNetwork, IssueCardRequest } from '@icb/contracts';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { ConflictError } from '../../../common/errors/index.js';
import { CONFIG, type AppConfiguration } from '../../../config/configuration.js';
import { newId } from '../../../infrastructure/database/identifier.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { AccountsService } from '../../accounts/accounts.service.js';
import { CustomerDoc } from '../../customers/infrastructure/customer.schemas.js';
import { defaultControls, defaultLimits, INITIAL_STATUS } from '../domain/card-defaults.js';
import { expiryFor, generateCvv, generatePan, panLast4 } from '../domain/card-numbers.js';
import { encryptField, fingerprint } from '../domain/pan-cipher.js';
import { CardDoc } from '../infrastructure/card.schemas.js';
import { CardReader } from './card-reader.js';

/** Everything that distinguishes one issued card from another. */
export interface IssueCardCommand {
  readonly customerId: string;
  readonly accountId: string;
  readonly kind: CardKind;
  readonly network: CardNetwork;
  readonly nickname: string | null;
  readonly currency: string;
  readonly deliveryAddressId: string;
  readonly replacedCardId: string | null;
}

/** The card's identity and its sealed secrets, assembled in one place. */
interface CardIdentityFields {
  _id: string;
  customerId: string;
  accountId: string;
  kind: string;
  network: string;
  status: string;
  nickname: string | null;
  panEncrypted: string;
  panFingerprint: string;
  panLast4: string;
  cvvEncrypted: string;
  deliveryAddressId: string;
  replacedCardId: string | null;
}

const PAN_ATTEMPTS = 5;

/**
 * Card issuance.
 *
 * The PAN is generated, encrypted and forgotten inside a single method — it exists in memory for
 * the length of one call and is never returned, logged, or handed to a caller. What the rest of
 * the system sees afterwards is the last four digits and a keyed fingerprint.
 *
 * A card is issued `issued`, not `active`: it becomes usable when the customer confirms they have
 * it in hand, which is the entire point of an activation step.
 */
@Injectable()
export class CardIssuanceService {
  private readonly logger = new Logger(CardIssuanceService.name);

  constructor(
    @InjectModel(CardDoc.name) private readonly cards: Model<CardDoc>,
    @InjectModel(CustomerDoc.name) private readonly customers: Model<CustomerDoc>,
    private readonly accounts: AccountsService,
    private readonly reader: CardReader,
    @Inject(CONFIG) private readonly config: AppConfiguration,
    private readonly clock: ClockService,
  ) {}

  /** Issue against an account the customer actually owns and that can still be spent from. */
  async issue(customerId: string, request: IssueCardRequest): Promise<CardDetail> {
    const account = await this.accounts.loadSpendable(request.accountId, customerId);

    const card = await this.create({
      customerId,
      accountId: account._id,
      kind: request.kind,
      network: request.network,
      nickname: request.nickname ?? null,
      currency: account.currency,
      deliveryAddressId: request.deliveryAddressId,
      replacedCardId: null,
    });

    return this.reader.detail(card);
  }

  /**
   * The staff console's issue. The account id is the only thing the client supplies: the owning
   * customer is resolved from the account itself, so a staff token never gets to say whose card
   * this is — and the account still has to be spendable, exactly as on the customer's own path.
   */
  async issueAsStaff(request: IssueCardRequest): Promise<CardDetail> {
    const account = await this.accounts.loadSpendable(request.accountId);
    return this.issue(account.customerId, request);
  }

  /** A replacement keeps the customer, account, kind and nickname; everything secret is new. */
  async reissue(previous: CardDoc): Promise<CardDoc> {
    return this.create({
      customerId: previous.customerId,
      accountId: previous.accountId,
      kind: previous.kind as CardKind,
      network: previous.network as CardNetwork,
      nickname: previous.nickname,
      currency: previous.currency,
      deliveryAddressId: previous.deliveryAddressId,
      replacedCardId: previous._id,
    });
  }

  private async create(command: IssueCardCommand): Promise<CardDoc> {
    const issuedAt = this.clock.now();
    const expiry = expiryFor(issuedAt);
    const identity = await this.buildIdentity(command);
    const cardholderName = await this.cardholderName(command.customerId);

    const [created] = await this.cards.create([
      {
        ...identity,
        cardholderName,
        expiryMonth: expiry.month,
        expiryYear: expiry.year,
        currency: command.currency,
        issuingCountry: this.config.bank.country,
        frozen: false,
        contactlessEnabled: command.kind !== 'virtual',
        pinHash: null,
        pinSetAt: null,
        controls: defaultControls(command.kind),
        limits: defaultLimits(command.kind),
        issuedAt,
        activatedAt: null,
      },
    ]);

    if (!created) {
      throw new ConflictError('The card could not be issued');
    }
    this.logger.log({ cardId: created._id, kind: command.kind }, 'Card issued');
    return created;
  }

  private async buildIdentity(command: IssueCardCommand): Promise<CardIdentityFields> {
    const key = this.config.crypto.fieldEncryptionKey;
    const pan = await this.allocatePan(command.network);

    return {
      _id: newId(),
      customerId: command.customerId,
      accountId: command.accountId,
      kind: command.kind,
      network: command.network,
      status: INITIAL_STATUS,
      nickname: command.nickname,
      panEncrypted: encryptField(pan.value, key),
      panFingerprint: pan.digest,
      panLast4: panLast4(pan.value),
      cvvEncrypted: encryptField(generateCvv(), key),
      deliveryAddressId: command.deliveryAddressId,
      replacedCardId: command.replacedCardId,
    };
  }

  /** Retry on a collision rather than failing the customer's request over a coincidence. */
  private async allocatePan(network: CardNetwork): Promise<{ value: string; digest: string }> {
    const key = this.config.crypto.fieldEncryptionKey;

    for (let attempt = 0; attempt < PAN_ATTEMPTS; attempt += 1) {
      const value = generatePan(network);
      const digest = fingerprint(value, key);
      const existing = await this.cards.exists({ panFingerprint: digest });
      if (!existing) {
        return { value, digest };
      }
    }
    throw new ConflictError('Could not allocate a unique card number');
  }

  /** The name embossed on the card. Uppercase, because that is how a card is printed. */
  private async cardholderName(customerId: string): Promise<string> {
    const customer = await this.customers.findById(customerId).lean();
    const individual = customer?.individual as { firstName?: string; lastName?: string } | null;
    const business = customer?.business as { legalName?: string } | null;

    const name =
      business?.legalName ?? [individual?.firstName, individual?.lastName].filter(Boolean).join(' ');

    return (name || this.config.bank.name).toUpperCase();
  }
}
