import type { StaffRole } from '@icb/contracts';

import type { TicketPriority, TicketStatus } from './domain/ticket.types.js';

/** First-response SLA, in hours, per ticket priority. */
export const SLA_HOURS_BY_PRIORITY: Readonly<Record<TicketPriority, number>> = {
  low: 72,
  normal: 24,
  high: 8,
  urgent: 4,
};

/** New tickets start here; only staff may change a ticket's priority. */
export const DEFAULT_TICKET_PRIORITY: TicketPriority = 'normal';

/** Statuses that still consume staff attention — workload counts and SLA breaches measure these. */
export const OPEN_TICKET_STATUSES: readonly TicketStatus[] = [
  'open',
  'awaiting_customer',
  'awaiting_agent',
];

export const TICKET_REFERENCE_PREFIX = 'SUP';
export const CALLBACK_REFERENCE_PREFIX = 'CB';

/** Roles allowed to work the support inbox. */
export const SUPPORT_STAFF_ROLES: readonly StaffRole[] = [
  'support',
  'operations',
  'admin',
  'super_admin',
];

/** Role considered when a ticket is auto-assigned. */
export const AUTO_ASSIGN_ROLE: StaffRole = 'support';

export const INBOX_DEFAULT_LIMIT = 50;
export const INBOX_MAX_LIMIT = 100;
export const CUSTOMER_TICKET_LIMIT = 100;
export const CALLBACK_LIST_LIMIT = 100;

export const MAX_ATTACHMENTS_PER_MESSAGE = 5;
export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
export const ATTACHMENT_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;

export const MS_PER_HOUR = 3_600_000;
export const MILLIS_PER_SECOND = 1000;

/**
 * Offline upload fallback, mirroring the KYC module: with no storage credentials configured the
 * API mints the same signature shape against the local upload path so the flow still runs.
 * Not a security boundary — the local store accepts anything.
 */
export const LOCAL_UPLOAD_PATH = '/v1/media/local-upload';
export const LOCAL_SIGNING_SECRET = 'icb-local-upload';
export const LOCAL_API_KEY = 'local';
