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
import {
  ADMIN_SECTION_CONFIG,
  buildAdminPath,
  getCanonicalAdminRoutablePaths,
  resolveAdminRoute,
  resolveSupportLandingSection,
} from '../../../app/admin/config/adminPageNavigationConfig';

describe('admin routing', () => {
  it('builds canonical admin paths with path segments', () => {
    expect(buildAdminPath('finance', 'plans-coupons')).toBe('/admin/finance/plans');
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
      section: 'plans',
    });
  });

  it('routes the support top-level click to the first actionable pending queue', () => {
    expect(resolveSupportLandingSection({ comments: 2, reports: 1, threads: 1, feedback: 1, refunds: 1 })).toBe('comments');
    expect(resolveSupportLandingSection({ reports: 1, threads: 1, feedback: 1, refunds: 1 })).toBe('reports');
    expect(resolveSupportLandingSection({ threads: 1, feedback: 1, refunds: 1 })).toBe('threads');
    expect(resolveSupportLandingSection({ feedback: 1, refunds: 1 })).toBe('feedback');
    expect(resolveSupportLandingSection({ refunds: 1 })).toBe('refunds');
    expect(resolveSupportLandingSection()).toBe('feedback');
  });

  it('maps the marketing tab to landing pages', () => {
    expect(resolveAdminRoute('marketing')).toEqual({
      tab: 'marketing',
      section: 'landing-pages',
    });
  });

  it('routes gamification and notification settings sections', () => {
    expect(resolveAdminRoute('settings', 'gamification')).toEqual({
      tab: 'settings',
      section: 'gamification',
    });
    expect(resolveAdminRoute('notificacoes')).toEqual({
      tab: 'settings',
      section: 'notifications',
    });
  });

  it('derives the auditable route inventory from the typed navigation authority', () => {
    const paths = getCanonicalAdminRoutablePaths();
    const configuredCount = Object.values(ADMIN_SECTION_CONFIG)
      .reduce((total, sections) => total + sections.length, 0);

    expect(paths).toHaveLength(configuredCount);
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths).toContain('/admin/panel/dashboard');
    expect(paths).toContain('/admin/settings/logs');
  });
});
