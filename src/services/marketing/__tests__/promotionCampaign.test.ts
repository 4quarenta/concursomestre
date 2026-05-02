import { describe, expect, it } from 'vitest';
import type { Promotion } from 'types';
import {
  buildPromotionPath,
  isPromotionActiveForSlug,
  normalizeCampaignBannerActionUrl,
  normalizePromotionNotificationActionUrl,
  normalizePromotionSlug,
  sanitizeCampaignActionUrl,
} from '../promotionCampaign';

const makePromotion = (patch: Partial<Promotion> = {}) => ({
  isActive: true,
  name: 'Black Friday',
  slug: 'black-friday',
  discountPercentage: 30,
  bannerText: 'Oferta ativa',
  themeColor: '#0f172a',
  landingPageTitle: 'Oferta especial',
  landingPageHeadline: 'Oferta especial',
  landingPageSubheadline: 'Desconto por tempo limitado',
  featuresHighlight: [],
  ...patch,
} as Promotion);

describe('promotion campaign helpers', () => {
  it('normalizes promotion slugs consistently', () => {
    expect(normalizePromotionSlug('Black Friday 2026!')).toBe('black-friday-2026');
  });

  it('requires the active promotion slug to match the route slug', () => {
    expect(isPromotionActiveForSlug(makePromotion({ slug: 'black-friday' }), 'black-friday')).toBe(true);
    expect(isPromotionActiveForSlug(makePromotion({ slug: 'black-friday' }), 'campanha-antiga')).toBe(false);
    expect(isPromotionActiveForSlug(makePromotion({ isActive: false }), 'black-friday')).toBe(false);
  });

  it('builds only canonical promotion paths with a usable slug', () => {
    expect(buildPromotionPath(makePromotion({ slug: 'Black Friday 2026!' }))).toBe('/promo/black-friday-2026');
    expect(buildPromotionPath(makePromotion({ slug: '' }))).toBe('');
  });

  it('sanitizes unsafe campaign action URLs', () => {
    expect(sanitizeCampaignActionUrl('javascript:alert(1)')).toBe('/planos');
    expect(sanitizeCampaignActionUrl('data:text/html,<script>alert(1)</script>')).toBe('/planos');
    expect(sanitizeCampaignActionUrl('//evil.test/path')).toBe('/planos');
    expect(sanitizeCampaignActionUrl('/admin')).toBe('/planos');
    expect(sanitizeCampaignActionUrl('/api/settings.php')).toBe('/planos');
    expect(sanitizeCampaignActionUrl('/planos?utm=campanha')).toBe('/planos?utm=campanha');
    expect(sanitizeCampaignActionUrl('https://concursomestre.com.br/oferta')).toBe('https://concursomestre.com.br/oferta');
  });

  it('uses the active promotion path as fallback for banner and notification CTAs', () => {
    const promotion = makePromotion({ slug: 'black-friday' });

    expect(normalizeCampaignBannerActionUrl('', promotion)).toBe('/promo/black-friday');
    expect(normalizePromotionNotificationActionUrl('javascript:alert(1)', promotion)).toBe('/promo/black-friday');
  });
});
