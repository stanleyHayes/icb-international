import type {
  ChatAuthor,
  ChatConversation,
  ChatHistoryResponse,
  ChatMessage,
  StaffChatInboxResponse,
  StartChatResponse,
} from '@icb/contracts';
import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../../common/errors/index.js';
import { newId } from '../../../infrastructure/database/identifier.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { CustomerDoc } from '../../customers/infrastructure/customer.schemas.js';
import { customerDisplayName } from '../../kyc/infrastructure/customer-profile.js';
import {
  CHAT_CLOSED_MESSAGE,
  CHAT_INBOX_LIMIT,
  MESSAGE_PREVIEW_LENGTH,
} from '../chat.constants.js';
import { toChatConversation, toChatMessage } from '../infrastructure/chat.mapper.js';
import {
  ChatConversationDoc,
  ChatMessageDoc,
} from '../infrastructure/chat.schemas.js';
import { ChatRealtimePort } from './chat-realtime.port.js';
import { ChatTokenService } from './chat-token.service.js';

/** Who is asking. Ownership is enforced here, never left to the caller. */
export type ChatAccessor =
  | { readonly type: 'visitor'; readonly conversationId: string }
  | { readonly type: 'customer'; readonly customerId: string }
  | { readonly type: 'staff' };

export interface StartConversationInput {
  readonly customerId?: string | null;
  readonly visitorName?: string | undefined;
}

export interface PostMessageInput {
  readonly author: ChatAuthor;
  readonly authorName: string;
  readonly body: string;
}

export interface PostedMessage {
  readonly message: ChatMessage;
  readonly conversation: ChatConversation;
}

/**
 * Live support chat.
 *
 * A conversation belongs to an identified customer or to an anonymous visitor whose only
 * credential is the visitor token minted here. Every read and write is scoped by the accessor:
 * a visitor token reaches exactly its bound conversation, a customer reaches their own, staff
 * reach them all.
 */
@Injectable()
export class ChatService {
  constructor(
    @InjectModel(ChatConversationDoc.name)
    private readonly conversations: Model<ChatConversationDoc>,
    @InjectModel(ChatMessageDoc.name) private readonly messages: Model<ChatMessageDoc>,
    @InjectModel(CustomerDoc.name) private readonly customers: Model<CustomerDoc>,
    private readonly chatTokens: ChatTokenService,
    private readonly clock: ClockService,
    @Inject(forwardRef(() => ChatRealtimePort))
    private readonly realtime: ChatRealtimePort,
  ) {}

  /**
   * Starts — or resumes — a conversation.
   *
   * A customer gets their existing open conversation back (there is one open chat per customer,
   * so a returning user continues the same thread); an anonymous visitor always starts a new
   * one. Either way the response carries a visitor token bound to the conversation, which is how
   * the browser resumes it after a page load.
   */
  async startConversation(input: StartConversationInput): Promise<StartChatResponse> {
    if (input.customerId) {
      const existing = await this.conversations
        .findOne({ customerId: input.customerId, status: 'open' })
        .sort({ createdAt: -1 })
        .lean();
      if (existing) {
        return {
          conversation: toChatConversation(existing),
          visitorToken: await this.chatTokens.issueVisitorToken(existing._id),
          messages: await this.historyFor(existing._id),
        };
      }
    }

    const conversationId = newId();
    const now = this.clock.now();
    const visitorName = input.customerId
      ? await this.customerNameFor(input.customerId)
      : (input.visitorName ?? null);

    const [created] = await this.conversations.create([
      {
        _id: conversationId,
        customerId: input.customerId ?? null,
        visitorName,
        status: 'open',
        assignedTo: null,
        lastMessagePreview: null,
        lastMessageAt: null,
        createdAt: now,
        closedAt: null,
      },
    ]);

    const conversation = toChatConversation(created as ChatConversationDoc);
    this.realtime.conversationStarted(conversation);

    return {
      conversation,
      visitorToken: await this.chatTokens.issueVisitorToken(conversationId),
      messages: [],
    };
  }

  /** The conversation and its history, oldest first, when the accessor is allowed to see it. */
  async getHistory(conversationId: string, accessor: ChatAccessor): Promise<ChatHistoryResponse> {
    const conversation = await this.load(conversationId);
    this.assertAccess(conversation, conversationId, accessor);
    return {
      conversation: toChatConversation(conversation),
      messages: await this.historyFor(conversationId),
    };
  }

  /** The conversation alone — used when minting a ws ticket from a visitor token. */
  async getConversation(conversationId: string, accessor: ChatAccessor): Promise<ChatConversation> {
    const conversation = await this.load(conversationId);
    this.assertAccess(conversation, conversationId, accessor);
    return toChatConversation(conversation);
  }

  /** Persists a message and folds it into the conversation's inbox row. */
  async postMessage(conversationId: string, input: PostMessageInput): Promise<PostedMessage> {
    const conversation = await this.load(conversationId);
    if (conversation.status === 'closed') {
      throw new ConflictError('This conversation is closed', { conversationId });
    }

    const now = this.clock.now();
    const preview = input.body.slice(0, MESSAGE_PREVIEW_LENGTH);

    const [message] = await this.messages.create([
      {
        _id: newId(),
        conversationId,
        author: input.author,
        authorName: input.authorName,
        body: input.body,
        sentAt: now,
      },
    ]);

    await this.conversations.updateOne(
      { _id: conversationId },
      { $set: { lastMessagePreview: preview, lastMessageAt: now } },
    );

    return {
      message: toChatMessage(message as ChatMessageDoc),
      conversation: toChatConversation({
        ...conversation,
        lastMessagePreview: preview,
        lastMessageAt: now,
      }),
    };
  }

  /** The staff work queue: open conversations, most recently active first. */
  async staffInbox(): Promise<StaffChatInboxResponse> {
    const rows = await this.conversations
      .find({ status: 'open' })
      .sort({ lastMessageAt: -1, createdAt: -1 })
      .limit(CHAT_INBOX_LIMIT)
      .lean();
    return { conversations: rows.map(toChatConversation) };
  }

  /** Closes the conversation and says so in the thread, so the visitor sees it end. */
  async closeConversation(conversationId: string, staffSub: string): Promise<ChatConversation> {
    const conversation = await this.load(conversationId);
    if (conversation.status === 'closed') {
      throw new ConflictError('This conversation is already closed', { conversationId });
    }

    const now = this.clock.now();
    const assignedTo = conversation.assignedTo ?? staffSub;
    await this.conversations.updateOne(
      { _id: conversationId },
      { $set: { status: 'closed', closedAt: now, assignedTo } },
    );

    const systemMessage = await this.postSystemMessage(conversationId, CHAT_CLOSED_MESSAGE, now);

    const closed = toChatConversation({
      ...conversation,
      status: 'closed',
      closedAt: now,
      assignedTo,
      lastMessagePreview: CHAT_CLOSED_MESSAGE,
      lastMessageAt: now,
    });
    this.realtime.conversationClosed(conversationId, systemMessage, closed);
    return closed;
  }

  /** A lifecycle note in the thread, e.g. that the conversation was closed. */
  private async postSystemMessage(
    conversationId: string,
    body: string,
    sentAt: Date,
  ): Promise<ChatMessage> {
    const [message] = await this.messages.create([
      { _id: newId(), conversationId, author: 'system', authorName: 'System', body, sentAt },
    ]);
    return toChatMessage(message as ChatMessageDoc);
  }

  /**
   * A visitor token names its conversation, a customer must own it — and learns no more than
   * "not found" when they do not, matching the support desk's anti-enumeration rule — and staff
   * see everything.
   */
  private assertAccess(
    conversation: ChatConversationDoc,
    conversationId: string,
    accessor: ChatAccessor,
  ): void {
    switch (accessor.type) {
      case 'staff':
        return;
      case 'visitor':
        if (accessor.conversationId !== conversationId) {
          throw new ForbiddenError('This token does not grant access to this conversation');
        }
        return;
      case 'customer':
        if (conversation.customerId !== accessor.customerId) {
          throw new NotFoundError('Conversation', conversationId);
        }
        return;
    }
  }

  private async historyFor(conversationId: string): Promise<ChatMessage[]> {
    const rows = await this.messages
      .find({ conversationId })
      .sort({ sentAt: 1, _id: 1 })
      .lean();
    return rows.map(toChatMessage);
  }

  private async load(conversationId: string): Promise<ChatConversationDoc> {
    const doc = await this.conversations.findOne({ _id: conversationId }).lean();
    if (!doc) {
      throw new NotFoundError('Conversation', conversationId);
    }
    return doc;
  }

  private async customerNameFor(customerId: string): Promise<string> {
    const customer = await this.customers.findById(customerId).lean();
    if (!customer) {
      throw new NotFoundError('Customer', customerId);
    }
    return customerDisplayName(customer);
  }
}
