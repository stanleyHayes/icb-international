/**
 * Live-chat constants.
 *
 * The token audiences keep chat credentials in their own world: a visitor token or a ws ticket
 * is signed with the access-token secret but can never be presented as an access token, nor the
 * reverse, because every verification pins the audience.
 */
export const CHAT_VISITOR_AUDIENCE = 'icb-chat-visitor';
export const CHAT_WS_AUDIENCE = 'icb-chat-ws';

/** Visitors resume a conversation across page loads, so the token outlives the session. */
export const VISITOR_TOKEN_TTL_SECONDS = 7 * 24 * 3_600;

/** Exchanged at the WebSocket upgrade; short-lived because it travels in the query string. */
export const WS_TICKET_TTL_SECONDS = 120;

/** The WebSocket route. Registered directly on Fastify, so the global prefix does not apply. */
export const CHAT_WS_PATH = '/v1/chat/ws';

/** Non-standard close codes in the application range (4000–4999). */
export const WS_CLOSE_UNAUTHENTICATED = 4401;
export const WS_CLOSE_FORBIDDEN = 4403;

export const WS_READY_STATE_OPEN = 1;

export const CHAT_INBOX_LIMIT = 100;

/** Display name for a visitor who gave none. */
export const GUEST_NAME = 'Guest';

/** The inbox row keeps a preview, not the whole message. */
export const MESSAGE_PREVIEW_LENGTH = 140;

/** Posted as a system message when staff close a conversation. */
export const CHAT_CLOSED_MESSAGE = 'Chat closed';
