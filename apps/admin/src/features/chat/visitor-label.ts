import type { ChatConversation } from '@icb/contracts';

/** The visitor's given name, or a "Guest" label keyed by a short slice of the id. */
export function visitorLabel(conversation: ChatConversation): string {
  return conversation.visitorName ?? `Guest ${conversation.id.slice(0, 6)}`;
}
