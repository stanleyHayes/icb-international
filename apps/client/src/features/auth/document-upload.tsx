'use client';

import type { KycDocument, KycDocumentType } from '@icb/contracts';
import { StatusBadge } from '@icb/ui';
import { FileDropzone } from '@icb/ui';
import { CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { FormAlert } from './form-alert';
import { uploadKycDocument } from './upload';

interface DocumentUploadProps {
  documentType: KycDocumentType;
  label: string;
  description: string;
  /** The document already on the case for this type, if any. */
  existing: KycDocument | null;
}

const MAX_SIZE_BYTES = 15 * 1024 * 1024;
const ACCEPTED = 'image/jpeg,image/png,image/webp,application/pdf';

/**
 * One document slot on the KYC case.
 *
 * Uploading replaces the previous document of the same type (the API does the replacing), so a
 * blurry first attempt costs nothing. The slot shows what the reviewer will see: the document's
 * status, not just that a file was chosen.
 */
export function DocumentUpload({
  documentType,
  label,
  description,
  existing,
}: Readonly<DocumentUploadProps>) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onFiles = async (files: File[]) => {
    const file = files[0];
    if (!file) {
      return;
    }
    setBusy(true);
    setError(null);
    const result = await uploadKycDocument(file, documentType);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  };

  return (
    <section aria-label={label} className="rounded-[var(--radius-lg)] border border-[var(--icb-border)] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold">{label}</h3>
          <p className="mt-0.5 text-sm text-[var(--icb-text-muted)]">{description}</p>
        </div>
        {existing ? <StatusBadge status={existing.status} /> : null}
      </div>

      <div className="mt-4">
        <FormAlert message={error} />
        {existing && !busy ? (
          <p className="flex items-center gap-2 text-sm text-[var(--icb-text-muted)]">
            <CheckCircle2 size={16} className="shrink-0 text-[var(--icb-success-fg)]" aria-hidden="true" />
            {existing.asset.originalFilename ?? 'Document'} received. Upload again to replace it.
          </p>
        ) : null}
        <FileDropzone
          className="mt-3"
          accept={ACCEPTED}
          maxFiles={1}
          maxSizeBytes={MAX_SIZE_BYTES}
          disabled={busy}
          hint={busy ? 'Uploading…' : 'JPEG, PNG, WebP or PDF, up to 15 MB'}
          onChange={(files) => void onFiles(files)}
          onReject={(rejections) =>
            setError(
              rejections[0]?.reason === 'size'
                ? 'That file is over 15 MB.'
                : 'That file type cannot be accepted. Use a JPEG, PNG, WebP or PDF.',
            )
          }
        />
      </div>
    </section>
  );
}
