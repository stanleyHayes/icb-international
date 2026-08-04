/**
 * The callback view returned by `GET/POST /support/callbacks`. The shape is defined in the
 * API (`apps/api/src/modules/support/infrastructure/support-requests.ts`) but has not been
 * upstreamed into @icb/contracts yet — contract request noted in the mission report.
 */
export interface CallbackView {
  id: string;
  reference: string;
  customerId: string;
  customerName: string;
  phone: string;
  reason: string;
  preferredWindow: string;
  ticketId: string | null;
  status: string;
  requestedAt: string;
  handledBy: string | null;
  handledAt: string | null;
  notes: string | null;
}

export const CALLBACK_WINDOWS = [
  { value: 'any', label: 'Any time' },
  { value: 'morning', label: 'Morning (9–12)' },
  { value: 'afternoon', label: 'Afternoon (12–17)' },
  { value: 'evening', label: 'Evening (17–20)' },
] as const;

export const TICKET_CATEGORIES = [
  { value: 'account', label: 'Account' },
  { value: 'card', label: 'Card' },
  { value: 'transfer', label: 'Transfer or payment' },
  { value: 'loan', label: 'Loan' },
  { value: 'technical', label: 'Technical problem' },
  { value: 'complaint', label: 'Complaint' },
  { value: 'other', label: 'Something else' },
] as const;

export const ATTACHMENT_ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf';
export const MAX_ATTACHMENTS = 5;
