'use client';

import { Button, Checkbox, Field, Input, Select, Textarea } from '@icb/ui';
import { useActionState } from 'react';

import { FormStatus } from './form-status';
import { createLocationAction, updateLocationAction } from './location-actions';
import { IDLE_STATE, type ContentLocationView } from './types';

const EMPTY_LOCATION = {
  name: '',
  type: 'branch' as const,
  address: { line1: '', line2: '', city: '', region: '', postalCode: '', country: '' },
  latitude: null as number | null,
  longitude: null as number | null,
  hours: '',
  services: [] as string[],
  active: true,
};

/** Optional coordinate for a number input; blank when unset. */
function coordinate(value: number | null): number | '' {
  return value ?? '';
}

/**
 * Create or edit a branch / ATM. Remounted per selection via `key`, so fields always start
 * from the selected location. Coordinates are optional — the locator falls back to the
 * address when they are blank.
 */
export function LocationForm({ editing }: Readonly<{ editing: ContentLocationView | null }>) {
  const [state, action, pending] = useActionState(
    editing ? updateLocationAction : createLocationAction,
    IDLE_STATE,
  );
  const location = editing ?? EMPTY_LOCATION;

  return (
    <form action={action} className="space-y-4">
      {editing ? <input type="hidden" name="locationId" value={editing.id} /> : null}

      <FormStatus
        state={state}
        doneMessage={editing ? 'Location updated.' : 'Location created.'}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" error={state.fieldErrors['name']} required>
          <Input name="name" defaultValue={location.name} required maxLength={120} />
        </Field>
        <Field label="Type" error={state.fieldErrors['type']} required>
          <Select name="type" defaultValue={location.type} required>
            <option value="branch">Branch</option>
            <option value="atm">ATM</option>
          </Select>
        </Field>
      </div>

      <AddressFields address={location.address} errors={state.fieldErrors} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Latitude" error={state.fieldErrors['latitude']}>
          <Input
            name="latitude"
            type="number"
            step="any"
            min={-90}
            max={90}
            defaultValue={coordinate(location.latitude)}
          />
        </Field>
        <Field label="Longitude" error={state.fieldErrors['longitude']}>
          <Input
            name="longitude"
            type="number"
            step="any"
            min={-180}
            max={180}
            defaultValue={coordinate(location.longitude)}
          />
        </Field>
      </div>

      <Field
        label="Opening hours"
        error={state.fieldErrors['hours']}
        description='Free text, e.g. "Mon–Fri 08:30–16:00, Sat 09:00–13:00".'
      >
        <Textarea name="hours" rows={2} defaultValue={location.hours} maxLength={500} />
      </Field>

      <Field
        label="Services"
        error={state.fieldErrors['services']}
        description="One per line, e.g. Cash deposits."
      >
        <Textarea name="services" rows={4} defaultValue={location.services.join('\n')} />
      </Field>

      <Checkbox
        name="active"
        label="Active — shown in the branch and ATM locator"
        defaultChecked={location.active}
      />

      <Button type="submit" loading={pending}>
        {editing ? 'Save changes' : 'Add location'}
      </Button>
    </form>
  );
}

/** The six address fields, posting flat inputs that the action nests under `address.*`. */
function AddressFields({
  address,
  errors,
}: Readonly<{
  address: ContentLocationView['address'];
  errors: Record<string, string>;
}>) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Address line 1" error={errors['address.line1']} required>
        <Input name="line1" defaultValue={address.line1} required maxLength={120} />
      </Field>
      <Field label="Address line 2" error={errors['address.line2']}>
        <Input name="line2" defaultValue={address.line2 ?? ''} maxLength={120} />
      </Field>
      <Field label="City" error={errors['address.city']} required>
        <Input name="city" defaultValue={address.city} required maxLength={80} />
      </Field>
      <Field label="Region" error={errors['address.region']}>
        <Input name="region" defaultValue={address.region ?? ''} maxLength={80} />
      </Field>
      <Field label="Postal code" error={errors['address.postalCode']}>
        <Input name="postalCode" defaultValue={address.postalCode ?? ''} maxLength={20} />
      </Field>
      <Field
        label="Country"
        error={errors['address.country']}
        description="Two-letter ISO code, e.g. GH."
        required
      >
        <Input name="country" defaultValue={address.country} required minLength={2} maxLength={2} />
      </Field>
    </div>
  );
}
