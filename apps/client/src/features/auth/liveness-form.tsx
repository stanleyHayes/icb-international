'use client';

import type { KycDocument } from '@icb/contracts';
import { Button, Checkbox, StatusBadge } from '@icb/ui';
import { Camera } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { FormAlert } from './form-alert';
import { submitKycAction } from './onboarding-actions';
import { uploadKycDocument } from './upload';

interface LivenessFormProps {
  selfie: KycDocument | null;
  documentsReady: boolean;
}

/**
 * The face check.
 *
 * A live selfie beside the identity document is what stops a stolen passport scan opening an
 * account. The capture is verified by the bank's own checks on the submitted case — no third
 * party ever sees the customer's face.
 */
export function LivenessForm({ selfie, documentsReady }: Readonly<LivenessFormProps>) {
  const router = useRouter();
  const cameraRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [declared, setDeclared] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const capture = async (file: File | undefined) => {
    if (!file) {
      return;
    }
    setBusy(true);
    setError(null);
    const result = await uploadKycDocument(file, 'selfie');
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  };

  const captureLabel = selfie ? 'Retake' : 'Open camera';

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    const result = await submitKycAction();
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push('/onboarding?step=account');
  };

  return (
    <div className="space-y-6">
      <FormAlert message={error} />

      <div className="flex flex-col items-start gap-4 rounded-[var(--radius-lg)] border border-[var(--icb-border)] p-5 sm:flex-row sm:items-center">
        <span
          aria-hidden="true"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--icb-bg-muted)] text-[var(--icb-text-muted)]"
        >
          <Camera size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            Take a selfie{' '}
            {selfie ? <StatusBadge status={selfie.status} /> : null}
          </p>
          <p className="mt-0.5 text-sm text-[var(--icb-text-muted)]">
            {selfie
              ? 'Selfie received. Take another to replace it.'
              : 'Face the camera in good light, nothing covering your face. We compare it with your identity document.'}
          </p>
        </div>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => cameraRef.current?.click()}
        >
          {busy ? 'Uploading…' : captureLabel}
        </Button>
        <input
          ref={cameraRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="user"
          className="sr-only"
          aria-label="Take a selfie"
          onChange={(event) => void capture(event.target.files?.[0])}
        />
      </div>

      <Checkbox
        name="declaration"
        label="The documents and details I provided are genuine and mine."
        checked={declared}
        onChange={(event) => setDeclared(event.target.checked)}
      />

      <Button
        size="lg"
        loading={submitting}
        disabled={!declared || !documentsReady || selfie === null}
        onClick={() => void submit()}
      >
        {submitting ? 'Submitting…' : 'Submit for verification'}
      </Button>
      {!documentsReady || selfie === null ? (
        <p className="text-xs text-[var(--icb-text-subtle)]">
          An identity document, proof of address and a selfie are all needed before you can submit.
        </p>
      ) : null}
    </div>
  );
}
