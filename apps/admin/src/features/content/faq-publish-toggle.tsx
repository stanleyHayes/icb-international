'use client';

import { Button } from '@icb/ui';
import { useActionState } from 'react';

import { setFaqPublishedAction } from './faq-actions';
import { IDLE_STATE } from './types';

/** Flip an article between published and draft without opening the editor. */
export function FaqPublishToggle({
  articleId,
  published,
}: Readonly<{ articleId: string; published: boolean }>) {
  const [state, action, pending] = useActionState(setFaqPublishedAction, IDLE_STATE);

  return (
    <form action={action} className="inline-flex items-center gap-1.5">
      <input type="hidden" name="articleId" value={articleId} />
      <input type="hidden" name="published" value={published ? 'false' : 'true'} />
      <Button type="submit" variant="ghost" size="sm" loading={pending}>
        {published ? 'Unpublish' : 'Publish'}
      </Button>
      {state.message ? (
        <span role="alert" className="text-xs text-[var(--icb-danger-fg)]">
          {state.message}
        </span>
      ) : null}
    </form>
  );
}
