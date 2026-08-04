'use client';

import { Button, Card, CardBody, CardHeader, EmptyState, StatusBadge, formatDate } from '@icb/ui';
import { Mail } from 'lucide-react';
import { useState } from 'react';

import { deleteTemplateAction } from './template-actions';
import { RowDeleteButton } from './row-delete-button';
import { TemplateForm } from './template-form';
import type { TemplateOverrideView } from './types';

/**
 * The templates tab: every notification template the bank has overridden, by key and channel.
 * Selecting a row loads it into the editor below; deleting a row returns that template to its
 * shipped default.
 */
export function TemplatesTab({ templates }: Readonly<{ templates: TemplateOverrideView[] }>) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = templates.find((template) => template.id === editingId) ?? null;

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        {templates.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <caption className="sr-only">Template overrides</caption>
              <thead>
                <tr className="border-b border-[var(--icb-border)] bg-[var(--icb-bg-subtle)] text-left text-[0.7rem] tracking-[0.08em] text-[var(--icb-text-subtle)] uppercase">
                  <th scope="col" className="px-5 py-2.5 font-medium">
                    Template
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Channel
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Subject
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Updated
                  </th>
                  <th scope="col" className="px-5 py-2.5 text-right font-medium">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--icb-border)]">
                {templates.map((template) => (
                  <tr key={template.id} className="hover:bg-[var(--icb-bg-subtle)]">
                    <td className="px-5 py-3">
                      <span className="font-mono text-xs font-medium">{template.key}</span>
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={template.channel} />
                    </td>
                    <td className="max-w-[240px] truncate px-3 py-3 text-xs text-[var(--icb-text-muted)]">
                      {template.subject || '—'}
                    </td>
                    <td className="px-3 py-3 text-xs text-[var(--icb-text-subtle)]">
                      {formatDate(template.updatedAt, 'medium')}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingId(template.id)}
                        >
                          Edit
                        </Button>
                        <RowDeleteButton
                          action={deleteTemplateAction}
                          field="templateId"
                          id={template.id}
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
            icon={<Mail size={20} />}
            title="No template overrides"
            description="Every notification is using its shipped default. Add an override below to change one."
          />
        )}
      </Card>

      <Card>
        <CardHeader
          title={editing ? `Edit “${editing.key}” (${editing.channel})` : 'New override'}
          description="Saving a key + channel that already has an override replaces it."
          action={
            editing ? (
              <Button type="button" variant="secondary" size="sm" onClick={() => setEditingId(null)}>
                New override
              </Button>
            ) : undefined
          }
        />
        <CardBody>
          <TemplateForm key={editing?.id ?? 'new'} editing={editing} />
        </CardBody>
      </Card>
    </div>
  );
}
