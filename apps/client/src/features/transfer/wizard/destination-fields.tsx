'use client';

import type { AccountSummary, Beneficiary, TransferRail } from '@icb/contracts';
import { Field, Input, Select, maskIdentifier } from '@icb/ui';

import type { DestinationDraft } from './draft-types';

interface DestinationFieldsProps {
  rail: TransferRail;
  draft: DestinationDraft;
  accounts: AccountSummary[];
  beneficiaries: Beneficiary[];
  fromAccountId: string;
  onChange: (patch: Partial<DestinationDraft>) => void;
}

/** Destination kinds each rail can settle to; used to filter the saved-payee picker. */
function compatibleKinds(rail: TransferRail): readonly string[] {
  switch (rail) {
    case 'on_us':
      return ['icb_customer'];
    case 'ach':
    case 'wire':
      return ['domestic_bank'];
    case 'swift':
      return ['international'];
    case 'internal':
      return [];
  }
}

/**
 * The destination inputs, whose shape follows the rail: a select for own accounts, an account
 * number for ICB customers, sort code + account number domestically, IBAN/BIC internationally.
 * Any rail except internal can also draw the details from a saved payee.
 */
export function DestinationFields({
  rail,
  draft,
  accounts,
  beneficiaries,
  fromAccountId,
  onChange,
}: Readonly<DestinationFieldsProps>) {
  const payees = beneficiaries.filter((b) => compatibleKinds(rail).includes(b.destination.kind));

  if (rail === 'internal') {
    return (
      <Field label="To account" required>
        <Select
          value={draft.accountId}
          onChange={(event) => onChange({ accountId: event.target.value })}
        >
          <option value="">Choose an account</option>
          {accounts
            .filter((account) => account.id !== fromAccountId)
            .map((account) => (
              <option key={account.id} value={account.id}>
                {account.nickname ?? account.productName} ·{' '}
                {maskIdentifier(account.identifiers.number)}
              </option>
            ))}
        </Select>
      </Field>
    );
  }

  return (
    <div className="space-y-5">
      {payees.length > 0 ? (
        <Field label="Saved payee" description="Pick one, or enter new details below.">
          <Select
            value={draft.mode === 'beneficiary' ? draft.beneficiaryId : ''}
            onChange={(event) =>
              event.target.value
                ? onChange({ mode: 'beneficiary', beneficiaryId: event.target.value })
                : onChange({ mode: 'new', beneficiaryId: '' })
            }
          >
            <option value="">Enter new details</option>
            {payees.map((payee) => (
              <option key={payee.id} value={payee.id}>
                {payee.nickname ?? payee.name} · {payee.displayIdentifier}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      {draft.mode === 'new' ? <NewPayeeFields rail={rail} draft={draft} onChange={onChange} /> : null}
    </div>
  );
}

function NewPayeeFields({
  rail,
  draft,
  onChange,
}: Readonly<{
  rail: TransferRail;
  draft: DestinationDraft;
  onChange: (patch: Partial<DestinationDraft>) => void;
}>) {
  if (rail === 'on_us') {
    return <IcbCustomerFields draft={draft} onChange={onChange} />;
  }
  if (rail === 'swift') {
    return <InternationalFields draft={draft} onChange={onChange} />;
  }
  return <DomesticFields draft={draft} onChange={onChange} />;
}

function IcbCustomerFields({
  draft,
  onChange,
}: Readonly<{ draft: DestinationDraft; onChange: (patch: Partial<DestinationDraft>) => void }>) {
  return (
    <Field label="ICB account number" required description="The 10-digit account number.">
      <Input
        value={draft.accountNumber}
        onChange={(event) => onChange({ accountNumber: event.target.value.trim() })}
        inputMode="numeric"
        placeholder="10 digits"
        maxLength={10}
        className="font-mono"
      />
    </Field>
  );
}

function DomesticFields({
  draft,
  onChange,
}: Readonly<{ draft: DestinationDraft; onChange: (patch: Partial<DestinationDraft>) => void }>) {
  return (
    <>
      <Field label="Account holder name" required>
        <Input
          value={draft.holderName}
          onChange={(event) => onChange({ holderName: event.target.value })}
          maxLength={140}
          autoComplete="off"
        />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Sort code" required description="Formatted 00-00-00.">
          <Input
            value={draft.sortCode}
            onChange={(event) => onChange({ sortCode: event.target.value })}
            inputMode="numeric"
            placeholder="00-00-00"
            maxLength={8}
            className="font-mono"
          />
        </Field>
        <Field label="Account number" required>
          <Input
            value={draft.accountNumber}
            onChange={(event) => onChange({ accountNumber: event.target.value.trim() })}
            inputMode="numeric"
            maxLength={20}
            className="font-mono"
          />
        </Field>
      </div>
    </>
  );
}

function InternationalFields({
  draft,
  onChange,
}: Readonly<{ draft: DestinationDraft; onChange: (patch: Partial<DestinationDraft>) => void }>) {
  return (
    <>
      <Field label="Account holder name" required>
        <Input
          value={draft.holderName}
          onChange={(event) => onChange({ holderName: event.target.value })}
          maxLength={140}
          autoComplete="off"
        />
      </Field>
      <Field label="IBAN" required>
        <Input
          value={draft.iban}
          onChange={(event) => onChange({ iban: event.target.value })}
          maxLength={34}
          placeholder="GB29 NWBK 6016 1331 9268 19"
          className="font-mono"
        />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="SWIFT / BIC" required>
          <Input
            value={draft.bic}
            onChange={(event) => onChange({ bic: event.target.value })}
            minLength={8}
            maxLength={11}
            className="font-mono"
          />
        </Field>
        <Field label="Country" required description="Two-letter code, e.g. DE.">
          <Input
            value={draft.country}
            onChange={(event) => onChange({ country: event.target.value.toUpperCase() })}
            maxLength={2}
            placeholder="DE"
            className="font-mono uppercase"
          />
        </Field>
      </div>
      <Field label="Bank name">
        <Input
          value={draft.bankName}
          onChange={(event) => onChange({ bankName: event.target.value })}
          maxLength={140}
        />
      </Field>
    </>
  );
}
