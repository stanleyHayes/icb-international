'use client';

import { Button, Field, Input, Select, Textarea } from '@icb/ui';
import { Eye } from 'lucide-react';
import { useActionState, useState, useTransition } from 'react';

import { FormStatus } from './form-status';
import {
  previewTemplateAction,
  upsertTemplateAction,
  type TemplateDraft,
} from './template-actions';
import {
  IDLE_STATE,
  type FormState,
  type TemplateOverrideView,
  type TemplatePreviewResult,
} from './types';

function draftFrom(editing: TemplateOverrideView | null): TemplateDraft {
  return {
    key: editing?.key ?? '',
    channel: editing?.channel ?? 'in_app',
    subject: editing?.subject ?? '',
    body: editing?.body ?? '',
  };
}

/**
 * Create or replace a template override, with a live render alongside.
 *
 * The fields are controlled so the Preview button renders exactly what is on screen, saved or
 * not. Remounted per selection via `key`, so editing another row resets the draft.
 */
export function TemplateForm({ editing }: Readonly<{ editing: TemplateOverrideView | null }>) {
  const [state, action, pending] = useActionState(upsertTemplateAction, IDLE_STATE);
  const [draft, setDraft] = useState<TemplateDraft>(() => draftFrom(editing));
  const [preview, setPreview] = useState<TemplatePreviewResult | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewPending, startPreview] = useTransition();

  const runPreview = () =>
    startPreview(async () => {
      const outcome = await previewTemplateAction(draft);
      if (outcome.ok) {
        setPreview(outcome.preview);
        setPreviewError(null);
      } else {
        setPreview(null);
        setPreviewError(outcome.message);
      }
    });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <TemplateFields
        action={action}
        state={state}
        pending={pending}
        draft={draft}
        onChange={setDraft}
        onPreview={runPreview}
        previewPending={previewPending}
      />
      <TemplatePreviewPane preview={preview} error={previewError} />
    </div>
  );
}

const CHANNELS = [
  { value: 'in_app', label: 'In-app' },
  { value: 'email', label: 'Email' },
  { value: 'sms', label: 'SMS' },
  { value: 'push', label: 'Push' },
] as const;

/** The override editor itself: key + channel identity, then the copy. */
function TemplateFields({
  action,
  state,
  pending,
  draft,
  onChange,
  onPreview,
  previewPending,
}: Readonly<{
  action: (payload: FormData) => void;
  state: FormState;
  pending: boolean;
  draft: TemplateDraft;
  onChange: (draft: TemplateDraft) => void;
  onPreview: () => void;
  previewPending: boolean;
}>) {
  const patch = (value: Partial<TemplateDraft>) => onChange({ ...draft, ...value });

  return (
    <form action={action} className="space-y-4">
      <FormStatus
        state={state}
        doneMessage="Override saved — it now applies to every send on this channel."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Template key" error={state.fieldErrors['key']} required>
          <Input
            name="key"
            value={draft.key}
            onChange={(event) => patch({ key: event.target.value })}
            required
            maxLength={80}
            placeholder="e.g. transfer_receipt"
          />
        </Field>
        <Field label="Channel" error={state.fieldErrors['channel']} required>
          <Select
            name="channel"
            value={draft.channel}
            onChange={(event) => patch({ channel: event.target.value })}
            required
          >
            {CHANNELS.map((channel) => (
              <option key={channel.value} value={channel.value}>
                {channel.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Subject" error={state.fieldErrors['subject']}>
        <Input
          name="subject"
          value={draft.subject}
          onChange={(event) => patch({ subject: event.target.value })}
          maxLength={200}
        />
      </Field>
      <Field
        label="Body"
        error={state.fieldErrors['body']}
        description="Insert variables with {{variableName}} — they are filled per customer at send time."
        required
      >
        <Textarea
          name="body"
          rows={8}
          value={draft.body}
          onChange={(event) => patch({ body: event.target.value })}
          required
        />
      </Field>

      <div className="flex gap-2">
        <Button type="submit" loading={pending}>
          Save override
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={onPreview}
          loading={previewPending}
          leadingIcon={<Eye size={15} />}
        >
          Preview
        </Button>
      </div>
    </form>
  );
}

/** Read-only render of the draft against sample data; nothing shown until Preview is pressed. */
function TemplatePreviewPane({
  preview,
  error,
}: Readonly<{ preview: TemplatePreviewResult | null; error: string | null }>) {
  return (
    <div
      aria-live="polite"
      className="h-fit rounded-[var(--radius-md)] border border-[var(--icb-border)] bg-[var(--icb-bg-subtle)] px-5 py-4"
    >
      <p className="text-[0.7rem] font-medium tracking-[0.08em] text-[var(--icb-text-subtle)] uppercase">
        Rendered preview
      </p>
      <PreviewBody preview={preview} error={error} />
    </div>
  );
}

function PreviewBody({
  preview,
  error,
}: Readonly<{ preview: TemplatePreviewResult | null; error: string | null }>) {
  if (error) {
    return (
      <p role="alert" className="mt-3 text-sm text-[var(--icb-danger-fg)]">
        {error}
      </p>
    );
  }
  if (!preview) {
    return (
      <p className="mt-3 text-sm text-[var(--icb-text-subtle)]">
        Press Preview to render this draft with sample data. Nothing is saved by previewing.
      </p>
    );
  }
  return (
    <div className="mt-3 space-y-3">
      {preview.subject ? <p className="text-sm font-semibold">{preview.subject}</p> : null}
      <p className="text-sm whitespace-pre-wrap text-[var(--icb-text-muted)]">{preview.body}</p>
    </div>
  );
}
