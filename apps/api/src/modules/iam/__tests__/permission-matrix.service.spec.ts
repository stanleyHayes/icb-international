import { STAFF_ROLES } from '@icb/contracts';
import { describe, expect, it } from 'vitest';

import { PERMISSIONS, ROLE_PERMISSIONS } from '../../../common/guards/permissions.constants.js';
import { PermissionMatrixService } from '../permission-matrix.service.js';

describe('PermissionMatrixService', () => {
  const service = new PermissionMatrixService();

  it('exposes the shared permission catalogue as data', () => {
    expect(service.catalog()).toEqual(PERMISSIONS);
  });

  it('exposes one matrix row per staff role, sourced from the single shared matrix', () => {
    const matrix = service.matrix();
    const byName = (a: string, b: string): number => a.localeCompare(b);
    expect(matrix.map((row) => row.role).sort(byName)).toEqual([...STAFF_ROLES].sort(byName));
    for (const row of matrix) {
      expect(row.permissions).toBe(ROLE_PERMISSIONS[row.role]);
    }
  });

  it('resolves the union of permissions across roles', () => {
    const resolved = service.resolve(['support', 'underwriter']);
    expect(resolved).toEqual(
      expect.arrayContaining(['customers:read', 'accounts:read', 'transactions:read', 'loans:read']),
    );
    expect(resolved).not.toContain('staff:manage');
  });

  it('grants super_admin every permission', () => {
    expect(service.resolve(['super_admin'])).toHaveLength(PERMISSIONS.length);
  });

  it('grants nothing to unknown roles', () => {
    expect(service.resolve(['not-a-role'])).toEqual([]);
  });
});
