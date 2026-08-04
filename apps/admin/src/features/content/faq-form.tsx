'use client';

import { Button, Checkbox, Field, Input, Textarea } from '@icb/ui';
import { useActionState } from 'react';

import { createFaqArticleAction, updateFaqArticleAction } from './faq-actions';
import { FormStatus } from './form-status';
import { IDLE_STATE, type FaqArticleView } from './types';

const EMPTY_ARTICLE = {
  title: '',
  slug: '',
  category: '',
  body: '',
  published: false,
  ordering: 0,
};

/**
 * Create or edit an FAQ article. The same form serves both: when a row is selected it posts
 * the update action with the article id, otherwise it creates. Remounted per selection via
 * `key`, so fields always start from the selected article.
 */
export function FaqForm({ editing }: Readonly<{ editing: FaqArticleView | null }>) {
  const [state, action, pending] = useActionState(
    editing ? updateFaqArticleAction : createFaqArticleAction,
    IDLE_STATE,
  );
  const article = editing ?? EMPTY_ARTICLE;

  return (
    <form action={action} className="space-y-4">
      {editing ? <input type="hidden" name="articleId" value={editing.id} /> : null}

      <FormStatus state={state} doneMessage={editing ? 'Article updated.' : 'Article created.'} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Title" error={state.fieldErrors['title']} required>
          <Input name="title" defaultValue={article.title} required maxLength={120} />
        </Field>
        <Field
          label="Slug"
          error={state.fieldErrors['slug']}
          description="Leave blank to derive it from the title."
        >
          <Input name="slug" defaultValue={article.slug} maxLength={140} />
        </Field>
        <Field label="Category" error={state.fieldErrors['category']} required>
          <Input
            name="category"
            defaultValue={article.category}
            required
            maxLength={60}
            placeholder="e.g. payments"
          />
        </Field>
        <Field label="Ordering" error={state.fieldErrors['ordering']} required>
          <Input
            name="ordering"
            type="number"
            min={0}
            max={9999}
            step={1}
            defaultValue={article.ordering}
            required
          />
        </Field>
      </div>

      <Field label="Body" error={state.fieldErrors['body']} required>
        <Textarea name="body" rows={8} defaultValue={article.body} required />
      </Field>

      <Checkbox
        name="published"
        label="Published — visible to customers"
        defaultChecked={article.published}
      />

      <Button type="submit" loading={pending}>
        {editing ? 'Save changes' : 'Create article'}
      </Button>
    </form>
  );
}
