import type {
  ChatConversation,
  ChatHistoryResponse,
  StaffChatInboxResponse,
  WsTicketResponse,
} from '@icb/contracts';
import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import type { AccessTokenClaims } from '../auth/application/token.service.js';
import { SUPPORT_STAFF_ROLES } from '../support/support.constants.js';
import { CHAT_WS_PATH } from './chat.constants.js';
import { ChatService } from './application/chat.service.js';
import { ChatTokenService } from './application/chat-token.service.js';

/**
 * The support desk's side of live chat, role-gated like the ticket inbox.
 *
 * The role guard is the boundary; inside it, conversations are looked up by id alone.
 */
@Controller('chat/staff')
@UseGuards(RolesGuard)
@Roles(...SUPPORT_STAFF_ROLES)
export class ChatStaffController {
  constructor(
    private readonly chat: ChatService,
    private readonly chatTokens: ChatTokenService,
  ) {}

  /** Open conversations, most recently active first. */
  @Get('inbox')
  inbox(): Promise<StaffChatInboxResponse> {
    return this.chat.staffInbox();
  }

  /** A conversation and its full history for the console's conversation view. */
  @Get('conversations/:conversationId')
  history(@Param('conversationId') conversationId: string): Promise<ChatHistoryResponse> {
    return this.chat.getHistory(conversationId, { type: 'staff' });
  }

  @Post('conversations/:conversationId/close')
  @HttpCode(HttpStatus.OK)
  close(
    @Param('conversationId') conversationId: string,
    @CurrentUser() staff: AccessTokenClaims,
  ): Promise<ChatConversation> {
    return this.chat.closeConversation(conversationId, staff.sub);
  }

  /** The agent's 120-second ticket for the WebSocket upgrade; not bound to a conversation. */
  @Post('ws-ticket')
  @HttpCode(HttpStatus.OK)
  async wsTicket(@CurrentUser() staff: AccessTokenClaims): Promise<WsTicketResponse> {
    return {
      ticket: await this.chatTokens.issueWsTicket({
        role: 'agent',
        sub: staff.sub,
        name: staff.email,
      }),
      wsPath: CHAT_WS_PATH,
    };
  }
}
