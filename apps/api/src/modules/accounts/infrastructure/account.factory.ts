import type { CurrencyCode } from '@icb/money';

/** The fields `AccountsService.open` needs to persist a new account. */
export interface OpenAccountCommand {
  readonly customerId: string;
  readonly productCode: string;
  readonly productName: string;
  readonly kind: string;
  readonly currency: CurrencyCode;
  readonly nickname?: string;
  readonly primary?: boolean;
  readonly interestRate?: number;
  readonly overdraftMinorUnits?: number;
  /** Injected so seeded data is reproducible (agent_plan.md SIM-04). */
  readonly entropy?: () => number;
}

export interface NewAccountIdentity {
  readonly id: string;
  readonly number: string;
  readonly iban: string;
  readonly bic: string;
  readonly sortCode: string;
  readonly openedAt: Date;
}

/** Build the persistence shape of a brand-new account. Pure, so seeding and tests share it. */
export function buildNewAccount(
  command: OpenAccountCommand,
  identity: NewAccountIdentity,
): Record<string, unknown> {
  return {
    _id: identity.id,
    customerId: command.customerId,
    productCode: command.productCode,
    productName: command.productName,
    kind: command.kind,
    number: identity.number,
    iban: identity.iban,
    bic: identity.bic,
    sortCode: identity.sortCode,
    currency: command.currency,
    status: 'active',
    nickname: command.nickname ?? null,
    primary: command.primary ?? false,
    overdraftMinorUnits: command.overdraftMinorUnits ?? 0,
    interestRate: command.interestRate ?? null,
    minimumBalanceMinorUnits: null,
    monthlyFeeMinorUnits: null,
    statementDay: 1,
    lastStatementAt: null,
    openedAt: identity.openedAt,
    closedAt: null,
    closureReason: null,
  };
}
