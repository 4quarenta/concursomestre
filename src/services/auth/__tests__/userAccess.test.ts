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

type AdminAccessUser = Parameters<typeof canAccessAdminPanel>[0];
type PartnerAccessUser = Parameters<typeof canAccessPartnerArea>[0];

const asAdminAccessUser = (user: Record<string, unknown>) => user as AdminAccessUser;
const asPartnerAccessUser = (user: Record<string, unknown>) => user as PartnerAccessUser;

describe('userAccess helpers', () => {
  it('normalizes only supported roles', () => {
    expect(normalizeUserRole('staff')).toBe('staff');
    expect(normalizeUserRole('partner')).toBe('partner');
    expect(normalizeUserRole('legacy')).toBe('user');
    expect(normalizeUserRole(undefined)).toBe('user');
  });

  it('allows staff or admin to access the admin panel', () => {
    expect(canAccessAdminPanel(asAdminAccessUser({ role: 'staff' }))).toBe(true);
    expect(canAccessAdminPanel(asAdminAccessUser({ role: 'admin' }))).toBe(true);
    expect(canAccessAdminPanel(asAdminAccessUser({ canAccessAdmin: true }))).toBe(true);
    expect(canAccessAdminPanel(asAdminAccessUser({ role: 'partner' }))).toBe(false);
  });

  it('keeps partner access separate from internal staff access', () => {
    expect(canAccessPartnerArea(asPartnerAccessUser({ role: 'partner' }))).toBe(true);
    expect(canAccessPartnerArea(asPartnerAccessUser({ role: 'admin' }))).toBe(true);
    expect(canAccessPartnerArea(asPartnerAccessUser({ role: 'staff' }))).toBe(false);
  });
});
