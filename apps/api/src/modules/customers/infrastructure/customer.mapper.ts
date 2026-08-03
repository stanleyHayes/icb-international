import type { CustomerAdminView, CustomerNote, CustomerProfile } from '@icb/contracts';

import type { CustomerNoteDoc } from './customer-note.schemas.js';
import type { CustomerDoc } from './customer.schemas.js';

/** The computed extras that turn a profile into the back-office view. */
export interface AdminViewExtras {
  readonly totalRelationshipValue: CustomerAdminView['totalRelationshipValue'];
  readonly accountCount: number;
  readonly internalNotes: number;
}

/**
 * Document → contract mapping, in exactly one place.
 *
 * The loosely-typed sub-documents (`individual`, `business`, `preferences`) are narrowed here
 * and nowhere else: every other module that renders a customer should import these functions
 * rather than growing its own cast, so a contract change has one file to update.
 */
export function toCustomerProfile(doc: CustomerDoc): CustomerProfile {
  return {
    id: doc._id,
    type: doc.type as CustomerProfile['type'],
    status: doc.status as CustomerProfile['status'],
    tier: doc.tier as CustomerProfile['tier'],
    email: doc.email,
    phone: doc.phone,
    individual: (doc.individual ?? null) as CustomerProfile['individual'],
    business: (doc.business ?? null) as CustomerProfile['business'],
    residentialAddress: (doc.residentialAddress ??
      null) as CustomerProfile['residentialAddress'],
    postalAddress: (doc.postalAddress ?? null) as CustomerProfile['postalAddress'],
    avatar: (doc.avatar ?? null) as CustomerProfile['avatar'],
    preferences: doc.preferences as CustomerProfile['preferences'],
    kyc: {
      level: doc.kycLevel as CustomerProfile['kyc']['level'],
      status: doc.kycStatus as CustomerProfile['kyc']['status'],
      verifiedAt: doc.kycVerifiedAt?.toISOString() ?? null,
      nextReviewAt: doc.kycNextReviewAt?.toISOString() ?? null,
    },
    memberSince: doc.memberSince.toISOString(),
  };
}

export function toCustomerAdminView(doc: CustomerDoc, extras: AdminViewExtras): CustomerAdminView {
  return {
    ...toCustomerProfile(doc),
    riskRating: doc.riskRating as CustomerAdminView['riskRating'],
    flags: (doc.flags ?? []) as CustomerAdminView['flags'],
    relationshipManager: doc.relationshipManager,
    totalRelationshipValue: extras.totalRelationshipValue,
    accountCount: extras.accountCount,
    lastActivityAt: doc.lastActivityAt?.toISOString() ?? null,
    internalNotes: extras.internalNotes,
  };
}

export function toCustomerNote(doc: CustomerNoteDoc): CustomerNote {
  return {
    id: doc._id,
    customerId: doc.customerId,
    body: doc.body,
    authorId: doc.authorId,
    authorName: doc.authorName,
    pinned: doc.pinned,
    createdAt: doc.createdAt.toISOString(),
  };
}
