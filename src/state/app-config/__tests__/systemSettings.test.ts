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

import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('@constants/index', () => ({
  PRICING: {
    Gratuito: { monthly: 0, quarterly: 0, annual: 0 },
    Essencial: { monthly: 19.9, quarterly: 59.7, annual: 238.8 },
    Pro: { monthly: 29.9, quarterly: 89.7, annual: 358.8 },
    Elite: { monthly: 36.97, quarterly: 110.91, annual: 443.64 },
  },
  PLAN_DETAILS: {
    Gratuito: { color: '#94a3b8', features: [] },
    Essencial: { color: '#2563eb', features: [] },
    Pro: { color: '#7c3aed', features: [] },
    Elite: { color: '#4f46e5', features: [] },
  },
}), { virtual: true });

vi.mock('@services/payments/stripePaymentMethodsConfig', () => ({
  DEFAULT_STRIPE_PAYMENT_METHODS_SETTINGS: { methods: [] },
  normalizeStripePaymentMethodsSettings: (settings: unknown) => settings || { methods: [] },
}), { virtual: true });

vi.mock('@constants/subscriptions/planEntitlements', () => ({
  DEFAULT_PLAN_ENTITLEMENTS: {},
  DEFAULT_PLAN_USAGE_LIMITS: {},
}), { virtual: true });

vi.mock('@constants/legal-commentary/featureAccess', () => ({
  DEFAULT_LEGAL_COMMENTARY_FEATURE_CONFIG: {},
  normalizeLegalCommentaryFeatureConfig: (settings: unknown) => settings || {},
}), { virtual: true });

vi.mock('@/app/landing/landingContent', () => ({
  createDefaultLandingPageContent: () => ({ featureCards: [], socialLinks: [] }),
  mergeLandingPageContent: (content: unknown) => content || { featureCards: [], socialLinks: [] },
}), { virtual: true });

vi.mock('@services/marketing/landingPages', () => ({
  mergeMarketingLandingPages: (pages: unknown) => pages || [],
}), { virtual: true });

vi.mock('@constants/email/defaultEmailTemplates', () => ({
  DEFAULT_EMAIL_TEMPLATES: [],
  normalizeEmailTemplates: (templates: unknown) => templates || [],
}), { virtual: true });

vi.mock('@constants/gamificationNotificationSettings', () => ({
  DEFAULT_GAMIFICATION_SETTINGS: { enabled: true, rules: [] },
  DEFAULT_NOTIFICATION_SETTINGS: { enabled: true, rules: [] },
  normalizeGamificationSettings: (settings: unknown) => settings || { enabled: true, rules: [] },
  normalizeNotificationSettings: (settings: unknown) => settings || { enabled: true, rules: [] },
}), { virtual: true });

vi.mock('@services/marketing/promotionCampaign', () => ({
  normalizeCampaignBannerActionUrl: (value: unknown) => value || '/planos',
  normalizePromotionNotificationActionUrl: (value: unknown) => value || '/planos',
}), { virtual: true });

type SystemSettingsModule = typeof import('../systemSettings');

let systemSettingsModule: SystemSettingsModule;

beforeAll(async () => {
  systemSettingsModule = await import('../systemSettings');
});

const makeCoupon = (code = 'PROD10') => ({
  code,
  discountPercentage: 10,
  uses: 0,
  maxUses: 100,
  autoApply: true,
  targetType: 'all' as const,
  targetId: null,
});

describe('system settings coupons', () => {
  it('does not ship with a default coupon that can reappear after removal', () => {
    const { DEFAULT_SYSTEM_SETTINGS } = systemSettingsModule;

    expect(DEFAULT_SYSTEM_SETTINGS.coupons).toEqual([]);
    expect(DEFAULT_SYSTEM_SETTINGS.features.supportDonationsEnabled).toBe(true);
  });

  it('preserves an explicit empty coupons list during merges', () => {
    const { DEFAULT_SYSTEM_SETTINGS, mergeSystemSettings } = systemSettingsModule;
    const base = mergeSystemSettings(DEFAULT_SYSTEM_SETTINGS, {
      coupons: [makeCoupon('OLD10')],
    });

    const merged = mergeSystemSettings(base, { coupons: [] });

    expect(merged.coupons).toEqual([]);
  });

  it('treats null persisted coupons as an explicit empty list', () => {
    const { DEFAULT_SYSTEM_SETTINGS, mergeSystemSettings } = systemSettingsModule;
    const base = mergeSystemSettings(DEFAULT_SYSTEM_SETTINGS, {
      coupons: [makeCoupon('OLD10')],
    });

    const merged = mergeSystemSettings(base, { coupons: null } as never);

    expect(merged.coupons).toEqual([]);
  });

  it('keeps pending coupon changes when the backend returns a partial settings payload', () => {
    const { DEFAULT_SYSTEM_SETTINGS, mergeSystemSettings, resolvePersistedSystemSettings } = systemSettingsModule;
    const pendingSettings = mergeSystemSettings(DEFAULT_SYSTEM_SETTINGS, {
      coupons: [makeCoupon('KEEP10')],
      activeTheme: 'estudante',
    });

    const persistedSettings = resolvePersistedSystemSettings(pendingSettings, {
      activeTheme: 'default',
    });

    expect(persistedSettings.activeTheme).toBe('default');
    expect(persistedSettings.coupons).toHaveLength(1);
    expect(persistedSettings.coupons[0]?.code).toBe('KEEP10');
  });

  it('keeps a deleted coupon deleted when save confirmation omits coupons', () => {
    const { DEFAULT_SYSTEM_SETTINGS, mergeSystemSettings, resolvePersistedSystemSettings } = systemSettingsModule;
    const pendingSettings = mergeSystemSettings(DEFAULT_SYSTEM_SETTINGS, {
      coupons: [],
      activeTheme: 'black-friday',
    });

    const persistedSettings = resolvePersistedSystemSettings(pendingSettings, {
      activeTheme: 'default',
    });

    expect(persistedSettings.activeTheme).toBe('default');
    expect(persistedSettings.coupons).toEqual([]);
  });
});
