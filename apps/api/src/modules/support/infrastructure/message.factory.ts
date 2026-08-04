import type { AssetRef } from '@icb/contracts';

import { newId } from '../../../infrastructure/database/identifier.js';
import type { MessageAuthor } from '../domain/ticket.types.js';

/** Everything needed to persist one message in a thread. */
export interface NewMessage {
  readonly ticketId: string;
  readonly customerId: string;
  readonly author: MessageAuthor;
  readonly authorId: string;
  readonly authorName: string;
  readonly body: string;
  readonly attachments: readonly AssetRef[];
  readonly sentAt: Date;
}

/** The document shape passed to `Model.create`. Explicit allow-list — no mass assignment. */
export function buildMessageDocument(input: NewMessage): Record<string, unknown> {
  return {
    _id: newId(),
    ticketId: input.ticketId,
    customerId: input.customerId,
    author: input.author,
    authorId: input.authorId,
    authorName: input.authorName,
    body: input.body,
    attachments: input.attachments.map((asset) => ({ ...asset })),
    sentAt: input.sentAt,
  };
}
