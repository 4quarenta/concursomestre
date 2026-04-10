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
import { buildAdminPath, resolveAdminRoute } from '../../../app/admin/config/adminPageNavigationConfig';

describe('admin routing', () => {
  it('builds canonical admin paths with path segments', () => {
    expect(buildAdminPath('finance', 'plans-coupons')).toBe('/admin/finance/plans-coupons');
    expect(buildAdminPath('support', 'reports', '#42')).toBe('/admin/support/reports#42');
  });

  it('maps legacy query-style targets to the canonical support path', () => {
    expect(resolveAdminRoute('operation', 'reports')).toEqual({
      tab: 'support',
      section: 'reports',
    });

    expect(resolveAdminRoute('reports')).toEqual({
      tab: 'support',
      section: 'reports',
    });
  });

  it('maps legacy finance aliases to the plans and coupons section', () => {
    expect(resolveAdminRoute('finance', 'prices')).toEqual({
      tab: 'finance',
      section: 'plans-coupons',
    });

    expect(resolveAdminRoute('marketing')).toEqual({
      tab: 'finance',
      section: 'plans-coupons',
    });
  });
});
