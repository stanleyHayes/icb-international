import type { ApprovalRequest } from '@icb/contracts';
import { Amount, Card, CardBody, CardHeader } from '@icb/ui';

import { DecisionPanel } from '@/features/approvals/decision-panel';

/** The headline figure, when the request is about money at all. */
export function AmountHeader({ amount }: Readonly<{ amount: ApprovalRequest['amount'] }>) {
  if (!amount) return null;
  return (
    <div className="text-right">
      <p className="text-xs font-medium tracking-[0.1em] text-[var(--icb-text-subtle)] uppercase">
        Amount
      </p>
      <p className="mt-1">
        <Amount value={amount} size="xl" />
      </p>
    </div>
  );
}

/**
 * The right half of the review screen: the decision panel while the request is decidable, or an
 * explanation of why it is not. An expired request is undecidable — offering the panel would
 * promise an action the server can only refuse.
 */
export function DecisionSection({
  approval,
  isSelf,
}: Readonly<{ approval: ApprovalRequest; isSelf: boolean }>) {
  if (approval.status !== 'pending') {
    return null;
  }

  if (new Date(approval.expiresAt).getTime() <= Date.now()) {
    return (
      <Card>
        <CardBody>
          <p className="text-sm text-[var(--icb-text-muted)]">
            This request expired before it was decided. The maker must raise it again if the
            action is still needed.
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Your decision"
        description="Requires a fresh verification code. Approving executes the action; rejecting cancels it."
      />
      <CardBody className="pt-0">
        <DecisionPanel approvalId={approval.id} isSelf={isSelf} />
      </CardBody>
    </Card>
  );
}
