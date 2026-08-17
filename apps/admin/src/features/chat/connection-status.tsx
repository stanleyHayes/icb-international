'use client';

import { Button, cn, type ChatSocketStatus } from '@icb/ui';
import { RefreshCw } from 'lucide-react';

const DOT_CLASS: Readonly<Record<ChatSocketStatus, string>> = {
  idle: 'bg-[var(--icb-text-subtle)]',
  connecting: 'bg-[var(--icb-warning-fg)]',
  open: 'bg-[var(--icb-success-fg)]',
  closed: 'bg-[var(--icb-text-subtle)]',
  error: 'bg-[var(--icb-danger-fg)]',
};

const STATUS_LABEL: Readonly<Record<ChatSocketStatus, string>> = {
  idle: 'Offline',
  connecting: 'Connecting…',
  open: 'Live',
  closed: 'Disconnected',
  error: 'Connection error',
};

/** A small live-connection readout, with an explicit reconnect once the socket drops. */
export function ConnectionStatus({
  status,
  onReconnect,
}: Readonly<{ status: ChatSocketStatus; onReconnect: () => void }>) {
  const dropped = status === 'closed' || status === 'error';
  return (
    <div className="flex items-center gap-3" role="status">
      <span className="flex items-center gap-2 text-sm text-[var(--icb-text-muted)]">
        <span aria-hidden="true" className={cn('h-2 w-2 rounded-full', DOT_CLASS[status])} />
        {STATUS_LABEL[status]}
      </span>
      {dropped ? (
        <Button variant="secondary" size="sm" onClick={onReconnect}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Reconnect
        </Button>
      ) : null}
    </div>
  );
}
