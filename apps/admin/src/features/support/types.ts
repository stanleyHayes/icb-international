import type { SupportMessage, SupportTicket } from '@icb/contracts';

/**
 * Staff-side support views.
 *
 * These mirror the shapes the staff API (`/support/staff/*`) returns. They are not part of
 * `@icb/contracts` yet — the API module declares them internally and a contract request has
 * been filed to upstream them — so the console keeps its own copy, structurally identical.
 */

export interface SatisfactionView {
  rating: number;
  comment: string | null;
  ratedAt: string;
}

/** The contract ticket plus the operational fields the inbox renders. */
export interface StaffTicketView extends SupportTicket {
  customerName: string;
  assignedToName: string | null;
  slaBreached: boolean;
  satisfaction: SatisfactionView | null;
}

export interface StaffTicketDetail {
  ticket: StaffTicketView;
  messages: SupportMessage[];
}

export interface MacroView {
  id: string;
  name: string;
  category: string;
  body: string;
  usageCount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

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

/** A staff member who can take tickets, reduced to what the assignment picker shows. */
export interface AssigneeOption {
  id: string;
  name: string;
}

/** Shared state shape for every support form action. */
export interface FormState {
  status: 'idle' | 'error' | 'done';
  message: string | null;
  fieldErrors: Record<string, string>;
}

export const IDLE_STATE: FormState = { status: 'idle', message: null, fieldErrors: {} };
