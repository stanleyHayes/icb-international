import type {
  attachDocumentRequestSchema,
  KycCase,
  KycDecisionRequest,
  KycDocumentType,
  KycLevel,
  KycQueueQuery,
  KycStatus,
  KycTierLimits,
  OffsetPage,
  SubmitKycRequest,
  UploadSignature,
  UploadSignatureRequest,
} from '@icb/contracts';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { ConflictError, NotFoundError, ValidationError } from '../../common/errors/index.js';
import { newId } from '../../infrastructure/database/identifier.js';
import { ClockService } from '../../simulation/clock/clock.service.js';
import { CustomerDoc } from '../customers/infrastructure/customer.schemas.js';
import type { DecisionActor } from './application/kyc-decision.service.js';
import { KycDecisionService } from './application/kyc-decision.service.js';
import { KycQueueService } from './application/kyc-queue.service.js';
import { UploadSignatureService } from './application/upload-signature.service.js';
import { deriveRiskRating, runChecks } from './domain/check-runner.js';
import { getLimitsFor, listTierLimits } from './domain/tier-limits.js';
import { customerDisplayName, customerKind } from './infrastructure/customer-profile.js';
import { toCheckSub, toKycCase } from './infrastructure/kyc.mapper.js';
import { KycCaseDoc, type KycDocumentSub } from './infrastructure/kyc.schemas.js';

type AttachDocumentRequest = ReturnType<typeof attachDocumentRequestSchema.parse>;

/**
 * Know Your Customer.
 *
 * One customer has one open case at a time. A decided case is never reopened — a customer who
 * comes back for a higher tier gets a new case — because a compliance file that can be edited
 * after the fact is not evidence of anything.
 */

/** Operations have two working days to clear a submitted case. */
const SLA_MS = 48 * 60 * 60 * 1000;
const TERMINAL: readonly KycStatus[] = ['approved', 'rejected', 'expired'];
const IN_PROGRESS: KycStatus = 'in_progress';
const PENDING_REVIEW: KycStatus = 'pending_review';

@Injectable()
export class KycService {
  constructor(
    @InjectModel(KycCaseDoc.name) private readonly cases: Model<KycCaseDoc>,
    @InjectModel(CustomerDoc.name) private readonly customers: Model<CustomerDoc>,
    private readonly signatures: UploadSignatureService,
    private readonly queue: KycQueueService,
    private readonly decisions: KycDecisionService,
    private readonly clock: ClockService,
  ) {}

  /** The customer's current case, opening one on first ask so the client always has something. */
  async caseFor(customerId: string): Promise<KycCase> {
    return toKycCase(await this.openCase(customerId));
  }

  mintUploadSignature(customerId: string, request: UploadSignatureRequest): UploadSignature {
    return this.signatures.mint(customerId, request);
  }

  /**
   * Attach an uploaded asset to the case. Re-uploading a document type replaces the previous
   * one: the reviewer should see the passport the customer meant to send, not a pile of retries.
   */
  async attachDocument(customerId: string, request: AttachDocumentRequest): Promise<KycCase> {
    const existing = await this.openCase(customerId);
    this.assertNotUnderReview(existing);

    const now = this.clock.now();
    const documents = [
      ...existing.documents.filter((document) => document.type !== request.type),
      buildDocument(request, now),
    ];

    return toKycCase(
      await this.patch(existing._id, { documents, status: IN_PROGRESS, updatedAt: now }),
    );
  }

  /**
   * Submit for review: this is where the simulated bureau runs, the risk rating is derived and
   * the SLA clock starts. Everything is recorded on the case so a reviewer sees the same
   * evidence the machine did.
   */
  async submit(customerId: string, request: SubmitKycRequest): Promise<KycCase> {
    const customer = await this.loadCustomer(customerId);
    const existing = await this.openCase(customerId, customer);
    this.assertNotUnderReview(existing);

    if (existing.documents.length === 0) {
      throw new ValidationError('At least one document is required before submitting', [
        { path: 'documents', message: 'Attach an identity document first' },
      ]);
    }

    const now = this.clock.now();
    const checks = runChecks({
      customerId,
      customerName: existing.customerName,
      customerType: customerKind(customer),
      documentTypes: existing.documents.map((document) => document.type as KycDocumentType),
      completedAt: now.toISOString(),
    });

    return toKycCase(
      await this.patch(existing._id, {
        requestedLevel: request.requestedLevel,
        status: PENDING_REVIEW,
        checks: checks.map(toCheckSub),
        riskRating: deriveRiskRating(checks),
        // A resubmission after "more information required" clears the previous instruction.
        decision: null,
        submittedAt: now,
        slaDueAt: new Date(now.getTime() + SLA_MS),
        updatedAt: now,
      }),
    );
  }

  /** The ceilings this customer is currently held to. */
  async limitsForCustomer(customerId: string): Promise<KycTierLimits> {
    const customer = await this.loadCustomer(customerId);
    const level = customer.kycStatus === 'approved' ? (customer.kycLevel as KycLevel | null) : null;
    return getLimitsFor(level);
  }

  /**
   * The tier table itself. Exported through the service so that the transfer pipeline can ask
   * "what may a tier-2 customer move?" without importing KYC's internals.
   */
  getLimitsFor(level: KycLevel | null): KycTierLimits {
    return getLimitsFor(level);
  }

  listLimits(): KycTierLimits[] {
    return listTierLimits();
  }

  // ---- Staff ---------------------------------------------------------------

  async listQueue(query: KycQueueQuery): Promise<OffsetPage<KycCase>> {
    return this.queue.list(query);
  }

  async caseById(caseId: string): Promise<KycCase> {
    return toKycCase(await this.queue.byId(caseId));
  }

  async decide(
    caseId: string,
    actor: DecisionActor,
    request: KycDecisionRequest,
  ): Promise<KycCase> {
    return this.decisions.decide(caseId, actor, request);
  }

  // ---- Internals -----------------------------------------------------------

  /** The customer's live case, or a fresh one when the last was decided. */
  private async openCase(customerId: string, preloaded?: CustomerDoc): Promise<KycCaseDoc> {
    const latest = await this.cases.findOne({ customerId }).sort({ createdAt: -1 }).lean();

    if (latest && !TERMINAL.includes(latest.status as KycStatus)) {
      return latest;
    }
    return this.createCase(preloaded ?? (await this.loadCustomer(customerId)));
  }

  private async createCase(customer: CustomerDoc): Promise<KycCaseDoc> {
    const now = this.clock.now();
    const created = await this.cases.create({
      _id: newId(),
      customerId: customer._id,
      customerName: customerDisplayName(customer),
      customerType: customerKind(customer),
      requestedLevel: 'tier_1',
      status: 'not_started' satisfies KycStatus,
      documents: [],
      checks: [],
      riskRating: null,
      decision: null,
      // Replaced with a real deadline on submission; a case nobody submitted breaches nothing.
      slaDueAt: new Date(now.getTime() + SLA_MS),
      submittedAt: null,
      assignedTo: null,
      createdAt: now,
      updatedAt: now,
    });

    return created.toObject();
  }

  private async patch(caseId: string, update: Record<string, unknown>): Promise<KycCaseDoc> {
    const updated = await this.cases
      .findOneAndUpdate({ _id: caseId }, { $set: update }, { new: true })
      .lean();

    if (!updated) {
      throw new NotFoundError('KYC case', caseId);
    }
    return updated;
  }

  private async loadCustomer(customerId: string): Promise<CustomerDoc> {
    const customer = await this.customers.findById(customerId).lean();
    if (!customer) {
      throw new NotFoundError('Customer', customerId);
    }
    return customer;
  }

  private assertNotUnderReview(row: KycCaseDoc): void {
    if (row.status === PENDING_REVIEW) {
      throw new ConflictError('This KYC case is already under review', { caseId: row._id });
    }
  }
}

function buildDocument(request: AttachDocumentRequest, now: Date): KycDocumentSub {
  return {
    id: newId(),
    type: request.type,
    asset: request.asset,
    status: 'uploaded',
    rejectionReason: null,
    documentNumber: request.documentNumber ?? null,
    issuingCountry: request.issuingCountry ?? null,
    expiresOn: request.expiresOn ?? null,
    uploadedAt: now,
    reviewedAt: null,
  };
}
