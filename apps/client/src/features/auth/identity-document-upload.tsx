'use client';

import type { KycDocument, KycDocumentType } from '@icb/contracts';
import { Field, Select } from '@icb/ui';
import { useState } from 'react';

import { DocumentUpload } from './document-upload';

const ID_DOCUMENT_TYPES = [
  { value: 'passport', label: 'Passport' },
  { value: 'national_id', label: 'National ID card' },
  { value: 'drivers_licence', label: 'Driving licence' },
] as const;

/**
 * The identity-document slot, with the document kind left to the customer.
 *
 * The reviewer cares that one strong government document is present, not which of the three the
 * customer happens to hold — so the slot adapts instead of demanding a specific paper.
 */
export function IdentityDocumentUpload({
  documents,
}: Readonly<{ documents: KycDocument[] }>) {
  const [type, setType] = useState<KycDocumentType>('passport');

  const existing = documents.find((document) => document.type === type) ?? null;

  return (
    <div className="space-y-4">
      <Field label="Which document are you uploading?">
        <Select
          value={type}
          onChange={(event) => setType(event.target.value as KycDocumentType)}
          aria-label="Identity document type"
        >
          {ID_DOCUMENT_TYPES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>

      <DocumentUpload
        documentType={type}
        label="Identity document"
        description="The photo page, in colour, all four corners visible."
        existing={existing}
      />
    </div>
  );
}
