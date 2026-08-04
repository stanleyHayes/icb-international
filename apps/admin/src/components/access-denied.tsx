import { EmptyState } from '@icb/ui';
import { Lock } from 'lucide-react';

/**
 * Shown when the API refuses a console page on permission grounds.
 *
 * RBAC nav keeps most operators from ever reaching a page they cannot use, but roles change
 * mid-session and URLs get pasted — the answer then is a plain explanation, not an error page.
 */
export function AccessDenied({ area }: Readonly<{ area: string }>) {
  return (
    <EmptyState
      icon={<Lock size={20} />}
      title="No access"
      description={`Your role does not include ${area}. Ask an administrator if you need it.`}
    />
  );
}
