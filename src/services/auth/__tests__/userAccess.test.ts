/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

import { describe, expect, it } from 'vitest';
import { canAccessAdminPanel, canAccessPartnerArea, normalizeUserRole } from '../userAccess';

describe('userAccess helpers', () => {
  it('normalizes only supported roles', () => {
    expect(normalizeUserRole('staff')).toBe('staff');
    expect(normalizeUserRole('partner')).toBe('partner');
    expect(normalizeUserRole('legacy')).toBe('user');
    expect(normalizeUserRole(undefined)).toBe('user');
  });

  it('allows staff or admin to access the admin panel', () => {
    expect(canAccessAdminPanel({ role: 'staff' } as any)).toBe(true);
    expect(canAccessAdminPanel({ role: 'admin' } as any)).toBe(true);
    expect(canAccessAdminPanel({ canAccessAdmin: true } as any)).toBe(true);
    expect(canAccessAdminPanel({ role: 'partner' } as any)).toBe(false);
  });

  it('keeps partner access separate from internal staff access', () => {
    expect(canAccessPartnerArea({ role: 'partner' } as any)).toBe(true);
    expect(canAccessPartnerArea({ role: 'admin' } as any)).toBe(true);
    expect(canAccessPartnerArea({ role: 'staff' } as any)).toBe(false);
  });
});
