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

  it('uses the canonical admin.access permission instead of role aliases', () => {
    expect(canAccessAdminPanel(asAdminAccessUser({ role: 'staff', permissions: ['admin.access'] }))).toBe(true);
    expect(canAccessAdminPanel(asAdminAccessUser({ role: 'admin', permissions: ['admin.access'] }))).toBe(true);
    expect(canAccessAdminPanel(asAdminAccessUser({ role: 'admin', permissions: [] }))).toBe(false);
    expect(canAccessAdminPanel(asAdminAccessUser({ canAccessAdmin: true, permissions: [] }))).toBe(false);
  });

  it('keeps partner access separate from internal staff access', () => {
    expect(canAccessPartnerArea(asPartnerAccessUser({ permissions: ['partner.access'] }))).toBe(true);
    expect(canAccessPartnerArea(asPartnerAccessUser({ partnershipStatus: 'active', permissions: [] }))).toBe(true);
    expect(canAccessPartnerArea(asPartnerAccessUser({ permissions: [] }))).toBe(false);
  });
});
