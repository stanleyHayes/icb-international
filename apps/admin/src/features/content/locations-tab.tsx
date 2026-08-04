'use client';

import { Button, Card, CardBody, CardHeader, EmptyState, StatusBadge } from '@icb/ui';
import { MapPin } from 'lucide-react';
import { useState } from 'react';

import { deleteLocationAction } from './location-actions';
import { LocationForm } from './location-form';
import { RowDeleteButton } from './row-delete-button';
import type { ContentLocationView } from './types';

/**
 * The locations tab: every branch and ATM the locator can show. Selecting a row loads it
 * into the form below; delete acts in place.
 */
export function LocationsTab({ locations }: Readonly<{ locations: ContentLocationView[] }>) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = locations.find((location) => location.id === editingId) ?? null;

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        {locations.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <caption className="sr-only">Branches and ATMs</caption>
              <thead>
                <tr className="border-b border-[var(--icb-border)] bg-[var(--icb-bg-subtle)] text-left text-[0.7rem] tracking-[0.08em] text-[var(--icb-text-subtle)] uppercase">
                  <th scope="col" className="px-5 py-2.5 font-medium">
                    Location
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Type
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    City
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Services
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
                {locations.map((location) => (
                  <tr key={location.id} className="hover:bg-[var(--icb-bg-subtle)]">
                    <td className="px-5 py-3 font-medium">{location.name}</td>
                    <td className="px-3 py-3 text-xs capitalize">{location.type}</td>
                    <td className="px-3 py-3 text-xs">{location.address.city}</td>
                    <td className="tabular px-3 py-3 text-xs text-[var(--icb-text-subtle)]">
                      {location.services.length}
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={location.active ? 'active' : 'inactive'} />
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingId(location.id)}
                        >
                          Edit
                        </Button>
                        <RowDeleteButton
                          action={deleteLocationAction}
                          field="locationId"
                          id={location.id}
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
            icon={<MapPin size={20} />}
            title="No locations yet"
            description="Add the first branch or ATM below; it appears in the locator once active."
          />
        )}
      </Card>

      <Card>
        <CardHeader
          title={editing ? `Edit “${editing.name}”` : 'New location'}
          description={
            editing
              ? 'Changes show in the locator as soon as they are saved.'
              : 'Inactive locations stay hidden from customers.'
          }
          action={
            editing ? (
              <Button type="button" variant="secondary" size="sm" onClick={() => setEditingId(null)}>
                New location
              </Button>
            ) : undefined
          }
        />
        <CardBody>
          <LocationForm key={editing?.id ?? 'new'} editing={editing} />
        </CardBody>
      </Card>
    </div>
  );
}
