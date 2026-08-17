import type { ChatHistoryResponse } from '@icb/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AccessTokenClaims } from '../../auth/application/token.service.js';
import type { ChatTokenService } from '../application/chat-token.service.js';
import type { ChatService } from '../application/chat.service.js';
import { ChatStaffController } from '../chat-staff.controller.js';

const STAFF = {
  sub: 'staff-1',
  customerId: null,
  email: 'sam@icb.example',
  roles: ['support'],
  sessionId: 'session-9',
} as AccessTokenClaims;

const HISTORY = {
  conversation: { id: 'conv-1', status: 'open' },
  messages: [{ id: 'msg-1', body: 'Hello' }],
} as unknown as ChatHistoryResponse;

describe('ChatStaffController', () => {
  let chat: Record<string, ReturnType<typeof vi.fn>>;
  let controller: ChatStaffController;

  beforeEach(() => {
    chat = {
      staffInbox: vi.fn().mockResolvedValue({ conversations: [] }),
      getHistory: vi.fn().mockResolvedValue(HISTORY),
      closeConversation: vi.fn().mockResolvedValue(HISTORY.conversation),
    };
    controller = new ChatStaffController(
      chat as unknown as ChatService,
      {} as unknown as ChatTokenService,
    );
  });

  it('loads a conversation history with the staff accessor, by id alone', async () => {
    const result = await controller.history('conv-1');

    expect(chat.getHistory).toHaveBeenCalledWith('conv-1', { type: 'staff' });
    expect(result).toEqual(HISTORY);
  });

  it('closes a conversation as the calling staff member', async () => {
    const result = await controller.close('conv-1', STAFF);

    expect(chat.closeConversation).toHaveBeenCalledWith('conv-1', 'staff-1');
    expect(result).toEqual(HISTORY.conversation);
  });
});
