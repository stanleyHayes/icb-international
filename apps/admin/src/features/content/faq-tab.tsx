'use client';

import { Button, Card, CardBody, CardHeader, EmptyState, StatusBadge } from '@icb/ui';
import { MessageCircleQuestion } from 'lucide-react';
import { useState } from 'react';

import { deleteFaqArticleAction } from './faq-actions';
import { FaqForm } from './faq-form';
import { FaqPublishToggle } from './faq-publish-toggle';
import { RowDeleteButton } from './row-delete-button';
import type { FaqArticleView } from './types';

/**
 * The FAQ tab: every article, ordered the way the help centre shows them, with the editor
 * below. Selecting a row loads it into the form; the publish toggle and delete act in place.
 */
export function FaqTab({ articles }: Readonly<{ articles: FaqArticleView[] }>) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = articles.find((article) => article.id === editingId) ?? null;
  const sorted = [...articles].sort((a, b) => a.ordering - b.ordering);

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        {sorted.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <caption className="sr-only">FAQ articles</caption>
              <thead>
                <tr className="border-b border-[var(--icb-border)] bg-[var(--icb-bg-subtle)] text-left text-[0.7rem] tracking-[0.08em] text-[var(--icb-text-subtle)] uppercase">
                  <th scope="col" className="px-5 py-2.5 font-medium">
                    Article
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Category
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Order
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Status
                  </th>
                  <th scope="col" className="px-5 py-2.5 text-right font-medium">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--icb-border)]">
                {sorted.map((article) => (
                  <tr key={article.id} className="hover:bg-[var(--icb-bg-subtle)]">
                    <td className="px-5 py-3">
                      <p className="font-medium">{article.title}</p>
                      <p className="font-mono text-xs text-[var(--icb-text-subtle)]">
                        {article.slug}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-xs">{article.category}</td>
                    <td className="tabular px-3 py-3 text-xs">{article.ordering}</td>
                    <td className="px-3 py-3">
                      <StatusBadge status={article.published ? 'active' : 'draft'} />
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingId(article.id)}
                        >
                          Edit
                        </Button>
                        <FaqPublishToggle articleId={article.id} published={article.published} />
                        <RowDeleteButton
                          action={deleteFaqArticleAction}
                          field="articleId"
                          id={article.id}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={<MessageCircleQuestion size={20} />}
            title="No FAQ articles yet"
            description="Write the first answer below; it appears in the help centre once published."
          />
        )}
      </Card>

      <Card>
        <CardHeader
          title={editing ? `Edit “${editing.title}”` : 'New article'}
          description={
            editing
              ? 'Changes apply to the help centre as soon as they are saved.'
              : 'Drafts stay hidden until published.'
          }
          action={
            editing ? (
              <Button type="button" variant="secondary" size="sm" onClick={() => setEditingId(null)}>
                New article
              </Button>
            ) : undefined
          }
        />
        <CardBody>
          <FaqForm key={editing?.id ?? 'new'} editing={editing} />
        </CardBody>
      </Card>
    </div>
  );
}
