import { describe, expect, it } from 'vitest';
import {
  getPromotionThemePresentation,
  resolvePromotionThemeId,
} from '../promotionTheme';

describe('promotionTheme', () => {
  it('uses the configured active theme as the visual authority', () => {
    expect(resolvePromotionThemeId({
      activeTheme: 'carnaval',
      activePromotion: { isActive: false, slug: 'black-friday' },
    } as never)).toBe('carnaval');
  });

  it('falls back to an active campaign slug when the theme is default', () => {
    expect(resolvePromotionThemeId({
      activeTheme: 'default',
      activePromotion: { isActive: true, slug: 'black-friday' },
    } as never)).toBe('black-friday');
  });

  it('keeps the neutral surface when no campaign is active', () => {
    expect(resolvePromotionThemeId({
      activeTheme: 'default',
      activePromotion: { isActive: false, slug: 'black-friday' },
    } as never)).toBe('default');
  });

  it('exposes characteristic presentation metadata for seasonal campaigns', () => {
    expect(getPromotionThemePresentation('sao-joao')).toMatchObject({
      label: 'SÃO JOÃO',
      motif: 'sao-joao',
    });
    expect(getPromotionThemePresentation('carnaval')).toMatchObject({
      label: 'CARNAVAL',
      motif: 'carnaval',
    });
  });
});
