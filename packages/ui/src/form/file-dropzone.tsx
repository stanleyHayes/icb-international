'use client';

import { useRef, useState, type ChangeEvent, type DragEvent, type KeyboardEvent } from 'react';

import { cn } from '../lib/cn';
import { IconClose } from '../primitives/icons';
import {
  DEFAULT_MAX_FILES,
  formatFileSize,
  validateFiles,
  type FileRejection,
} from './file-utils';
import { FORM_COPY } from './form.constants';
import { useFieldA11y } from './use-field';

export interface FileDropzoneProps {
  readonly value?: readonly File[];
  readonly onChange?: (files: File[]) => void;
  /** Files that failed the accept/size rules, with per-file reasons. */
  readonly onReject?: (rejections: FileRejection[]) => void;
  readonly accept?: string;
  readonly maxFiles?: number;
  readonly maxSizeBytes?: number;
  readonly name?: string;
  readonly hint?: string;
  readonly disabled?: boolean;
  readonly invalid?: boolean;
  readonly id?: string;
  readonly className?: string;
}

/**
 * Drag-and-drop file picker for document uploads. The zone is a real focusable button —
 * Enter/Space opens the native picker — and the hidden `<input type="file">` does the actual
 * work, so keyboard and screen-reader users get the same flow as pointer users.
 */
export function FileDropzone({
  value = [],
  onChange,
  onReject,
  accept,
  maxFiles = DEFAULT_MAX_FILES,
  maxSizeBytes,
  name,
  hint,
  disabled,
  invalid,
  id,
  className,
}: Readonly<FileDropzoneProps>) {
  const a11y = useFieldA11y({ id, disabled, invalid });
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const addFiles = (incoming: readonly File[]) => {
    const { accepted, rejections } = validateFiles(incoming, { accept, maxSizeBytes });
    onChange?.([...value, ...accepted].slice(0, maxFiles));
    if (rejections.length > 0) {
      onReject?.(rejections);
    }
  };

  const openPicker = () => {
    if (a11y.disabled !== true) {
      inputRef.current?.click();
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openPicker();
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    if (a11y.disabled !== true) {
      addFiles(Array.from(event.dataTransfer.files));
    }
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(event.target.files ?? []));
    const input = event.currentTarget;
    input.value = '';
  };

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div
        role="button"
        id={a11y.id}
        tabIndex={a11y.disabled === true ? -1 : 0}
        aria-disabled={a11y.disabled}
        aria-describedby={a11y.describedBy}
        aria-invalid={a11y.invalid}
        onClick={openPicker}
        onKeyDown={handleKeyDown}
        onDrop={handleDrop}
        onDragOver={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        className={cn(
          'flex cursor-pointer flex-col items-center gap-1.5 rounded-[var(--radius-lg)] border-2 border-dashed px-4 py-8 text-center transition-colors duration-150',
          'border-[var(--icb-border-strong)] bg-[var(--icb-bg-subtle)] text-[var(--icb-text-muted)]',
          'focus-visible:outline-none focus-visible:focus-ring',
          dragActive && 'border-[var(--icb-primary)] bg-[var(--icb-primary-subtle)]',
          a11y.invalid === true && 'border-[var(--icb-danger)]',
          a11y.disabled === true && 'cursor-not-allowed opacity-50',
        )}
      >
        <UploadGlyph />
        <span className="text-sm font-medium text-[var(--icb-text)]">{hint ?? FORM_COPY.dropzoneHint}</span>
        <span className="text-xs">{rulesSummary(accept, maxSizeBytes)}</span>
        <input
          ref={inputRef}
          type="file"
          name={name}
          accept={accept}
          multiple={maxFiles !== 1}
          disabled={a11y.disabled}
          tabIndex={-1}
          aria-hidden="true"
          onClick={(event) => event.stopPropagation()}
          onChange={handleInputChange}
          className="hidden"
        />
      </div>
      <FileList files={value} onRemove={(index) => onChange?.(value.filter((_, i) => i !== index))} />
    </div>
  );
}

function rulesSummary(accept: string | undefined, maxSizeBytes: number | undefined): string {
  const type = accept != null ? `Accepted: ${accept}` : 'Any file type';
  return maxSizeBytes != null ? `${type} · up to ${formatFileSize(maxSizeBytes)} each` : type;
}

function FileList({
  files,
  onRemove,
}: Readonly<{ files: readonly File[]; onRemove: (index: number) => void }>) {
  if (files.length === 0) {
    return null;
  }
  return (
    <ul className="flex flex-col gap-1">
      {files.map((file, index) => (
        <li
          key={`${file.name}-${index}`}
          className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-[var(--icb-border)] bg-[var(--icb-surface)] px-3 py-2 text-sm"
        >
          <span className="truncate text-[var(--icb-text)]">{file.name}</span>
          <span className="flex shrink-0 items-center gap-2">
            <span className="tabular text-xs text-[var(--icb-text-subtle)]">
              {formatFileSize(file.size)}
            </span>
            <button
              type="button"
              aria-label={`Remove ${file.name}`}
              onClick={() => onRemove(index)}
              className="rounded-[var(--radius-sm)] p-1 text-[var(--icb-text-subtle)] transition-colors hover:text-[var(--icb-danger)] focus-visible:outline-none focus-visible:focus-ring"
            >
              <IconClose size="sm" />
            </button>
          </span>
        </li>
      ))}
    </ul>
  );
}

function UploadGlyph() {
  return (
    <svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className="text-[var(--icb-text-subtle)]"
    >
      <path d="M12 15.5V4.5" />
      <path d="M7.5 8.75 12 4.25l4.5 4.5" />
      <path d="M4.5 19.5h15" />
    </svg>
  );
}
