'use client';

import { ChatWidget, type ChatWidgetConnectResult } from '@icb/ui';

import { connectChat } from './actions';

/**
 * The floating live-chat launcher, mounted in the dashboard layout so it is available on
 * every authenticated page. `connect` runs the server action on first open; a failure is
 * thrown back into the widget, which renders its own error state with a retry button.
 */
export function ClientChat() {
  const connect = async (): Promise<ChatWidgetConnectResult> => {
    const result = await connectChat();
    if (!result.ok) {
      throw new Error(result.error);
    }
    return { wsUrl: result.wsUrl, conversation: result.conversation, messages: result.messages };
  };

  return <ChatWidget title="Chat with support" connect={connect} />;
}
