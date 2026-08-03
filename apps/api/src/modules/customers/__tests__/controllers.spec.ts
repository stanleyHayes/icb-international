import {
  customerAdminViewSchema,
  customerNoteSchema,
  customerProfileSchema,
  downloadLinkSchema,
} from '@icb/contracts';
import { z } from 'zod';
import { describe, expect, it, vi } from 'vitest';

import type { CustomerExportService } from '../customer-export.service.js';
import type { CustomerLifecycleService } from '../customer-lifecycle.service.js';
import type { CustomerNotesService } from '../customer-notes.service.js';
import { CustomersAdminController } from '../customers-admin.controller.js';
import { CustomersController } from '../customers.controller.js';
import type { CustomersService } from '../customers.service.js';
import { toCustomerAdminView, toCustomerNote, toCustomerProfile } from '../infrastructure/customer.mapper.js';
import { customerDoc, NOW } from './fixtures.js';

const STAFF = {
  sub: 'staff-1',
  customerId: null,
  email: 'ope@icb.example',
  roles: ['admin'],
  sessionId: 'sess-1',
};

const ADMIN_EXTRAS = {
  totalRelationshipValue: { minorUnits: 0, currency: 'USD', scale: 2 },
  accountCount: 0,
  internalNotes: 0,
};

/**
 * Contract tests: every response a controller can emit is parsed by the contract schema the
 * SDK promises, so a mapper that drifts from `@icb/contracts` fails here, not in a client.
 */
describe('CustomersController', () => {
  const profile = toCustomerProfile(customerDoc());

  function setup() {
    const customers = {
      me: vi.fn().mockResolvedValue(profile),
      updateProfile: vi.fn().mockResolvedValue(profile),
      updatePreferences: vi.fn().mockResolvedValue(profile),
    };
    const exports = {
      exportData: vi.fn().mockResolvedValue({
        url: 'http://localhost/media/x?sig=1',
        expiresAt: NOW.toISOString(),
        filename: 'personal-data-export.pdf',
      }),
    };
    const controller = new CustomersController(
      customers as unknown as CustomersService,
      exports as unknown as CustomerExportService,
    );
    return { customers, exports, controller };
  }

  it('GET /customers/me returns a schema-valid profile for the token customer', async () => {
    const { customers, controller } = setup();

    const result = await controller.me('01J8ZCQ0R0K3M4N5P6Q7R8S9T0');

    expect(customers.me).toHaveBeenCalledWith('01J8ZCQ0R0K3M4N5P6Q7R8S9T0');
    expect(() => customerProfileSchema.parse(result)).not.toThrow();
  });

  it('PATCH /customers/me forwards the validated body and the token customer', async () => {
    const { customers, controller } = setup();
    const body = { phone: '+233200000001' };

    const result = await controller.updateMe('01J8ZCQ0R0K3M4N5P6Q7R8S9T0', body);

    expect(customers.updateProfile).toHaveBeenCalledWith('01J8ZCQ0R0K3M4N5P6Q7R8S9T0', body);
    expect(() => customerProfileSchema.parse(result)).not.toThrow();
  });

  it('PATCH /customers/me/preferences returns a schema-valid profile', async () => {
    const { customers, controller } = setup();
    const body = { marketingEmail: true };

    const result = await controller.updatePreferences('01J8ZCQ0R0K3M4N5P6Q7R8S9T0', body);

    expect(customers.updatePreferences).toHaveBeenCalledWith('01J8ZCQ0R0K3M4N5P6Q7R8S9T0', body);
    expect(() => customerProfileSchema.parse(result)).not.toThrow();
  });

  it('POST /customers/me/export returns a schema-valid download link', async () => {
    const { exports, controller } = setup();

    const result = await controller.exportData('01J8ZCQ0R0K3M4N5P6Q7R8S9T0');

    expect(exports.exportData).toHaveBeenCalledWith('01J8ZCQ0R0K3M4N5P6Q7R8S9T0');
    expect(() => downloadLinkSchema.parse(result)).not.toThrow();
  });
});

describe('CustomersAdminController', () => {
  const adminView = toCustomerAdminView(customerDoc(), ADMIN_EXTRAS);
  const note = toCustomerNote({
    _id: '01J8ZCQ0R0K3M4N5P6Q7R8S9T1',
    customerId: '01J8ZCQ0R0K3M4N5P6Q7R8S9T0',
    body: 'Called about a limit increase',
    authorId: '01J8ZCQ0R0K3M4N5P6Q7R8S9T2',
    authorName: 'ope@icb.example',
    pinned: false,
    createdAt: NOW,
  });

  function setup() {
    const lifecycle = { setStatus: vi.fn().mockResolvedValue(adminView) };
    const notes = {
      list: vi.fn().mockResolvedValue([note]),
      create: vi.fn().mockResolvedValue(note),
    };
    const controller = new CustomersAdminController(
      lifecycle as unknown as CustomerLifecycleService,
      notes as unknown as CustomerNotesService,
    );
    return { lifecycle, notes, controller };
  }

  it('POST /admin/customers/:id/status takes the actor from the token, never the body', async () => {
    const { lifecycle, controller } = setup();
    const body = { status: 'suspended' as const, reason: 'Fraud review underway' };

    const result = await controller.setStatus(STAFF, '01J8ZCQ0R0K3M4N5P6Q7R8S9T0', body);

    expect(lifecycle.setStatus).toHaveBeenCalledWith('01J8ZCQ0R0K3M4N5P6Q7R8S9T0', body, {
      id: 'staff-1',
      label: 'ope@icb.example',
    });
    expect(() => customerAdminViewSchema.parse(result)).not.toThrow();
  });

  it('GET /admin/customers/:id/notes returns a schema-valid note list', async () => {
    const { controller } = setup();

    const result = await controller.listNotes('01J8ZCQ0R0K3M4N5P6Q7R8S9T0');

    expect(() => z.array(customerNoteSchema).parse(result)).not.toThrow();
  });

  it('POST /admin/customers/:id/notes attributes the note to the token staff member', async () => {
    const { notes, controller } = setup();
    const body = { body: 'Called about a limit increase', pinned: false };

    const result = await controller.createNote(STAFF, '01J8ZCQ0R0K3M4N5P6Q7R8S9T0', body);

    expect(notes.create).toHaveBeenCalledWith('01J8ZCQ0R0K3M4N5P6Q7R8S9T0', body, {
      id: 'staff-1',
      name: 'ope@icb.example',
    });
    expect(() => customerNoteSchema.parse(result)).not.toThrow();
  });
});
