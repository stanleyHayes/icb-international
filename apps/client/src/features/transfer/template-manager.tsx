'use client';

import type { AccountSummary, TransferTemplate } from '@icb/contracts';
import { Button, Card, EmptyState } from '@icb/ui';
import { LayoutTemplate, Plus } from 'lucide-react';
import { useState } from 'react';

import { TemplateCreateDialog } from './template-create-dialog';
import { TemplateList } from './template-list';

/** Templates screen body: list plus the create dialog trigger. */
export function TemplateManager({
  templates,
  accounts,
}: Readonly<{ templates: TransferTemplate[]; accounts: AccountSummary[] }>) {
  const [creating, setCreating] = useState(false);

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)}>
          <Plus size={16} />
          New template
        </Button>
      </div>

      <Card className="mt-4 overflow-hidden">
        {templates.length > 0 ? (
          <TemplateList templates={templates} />
        ) : (
          <EmptyState
            icon={<LayoutTemplate size={20} />}
            title="No templates yet"
            description="Save a transfer as a template at the confirmation step, or create one here."
          />
        )}
      </Card>

      <TemplateCreateDialog
        accounts={accounts}
        open={creating}
        onClose={() => setCreating(false)}
      />
    </>
  );
}
