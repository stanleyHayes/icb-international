'use client';

import { Button, Field, Input } from '@icb/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { updateBeneficiaryAction } from './actions';

/** Rename a payee. Only the nickname is editable; account details never are — re-add instead. */
export function EditNicknameForm({
  beneficiaryId,
  initialNickname,
}: Readonly<{ beneficiaryId: string; initialNickname: string }>) {
  const router = useRouter();
  const [nickname, setNickname] = useState(initialNickname);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    const result = await updateBeneficiaryAction({
      beneficiaryId,
      nickname: nickname.trim() === '' ? null : nickname.trim(),
    });
    setBusy(false);
    if (result.status === 'error') {
      setError(result.message);
    } else {
      setSaved(true);
      router.refresh();
    }
  }

  return (
    <div className="flex items-end gap-3">
      <div className="flex-1">
        <Field label="Nickname">
          <Input
            value={nickname}
            onChange={(event) => {
              setNickname(event.target.value);
              setSaved(false);
            }}
            maxLength={60}
            placeholder="e.g. Landlord"
          />
        </Field>
      </div>
      <Button
        variant="secondary"
        disabled={busy || nickname.trim() === initialNickname.trim()}
        loading={busy}
        onClick={() => void save()}
      >
        Save
      </Button>
      <span aria-live="polite" className="self-center text-sm">
        {saved ? <span className="text-[var(--icb-success-fg)]">Saved</span> : null}
        {error ? (
          <span role="alert" className="text-[var(--icb-danger-fg)]">
            {error}
          </span>
        ) : null}
      </span>
    </div>
  );
}
