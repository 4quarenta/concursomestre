import { describe, expect, it } from 'vitest';
import { taxonomyPromotionPolicy, validateTaxonomyPromotionPolicy } from './taxonomyPromotionPolicy';

describe('taxonomy promotion policy v1', () => {
  it('keeps promotion disabled until real calibration exists', () => {
    expect(validateTaxonomyPromotionPolicy(taxonomyPromotionPolicy)).toBe(true);
    expect(taxonomyPromotionPolicy.enforcement).toBe(false);
    expect(taxonomyPromotionPolicy.calibrationRequired).toBe(true);
    expect(taxonomyPromotionPolicy.thresholds).toEqual({
      minimumPublicQuestions: null, minimumDistinctRelations: null, maximumOverlap: null,
    });
  });

  it('freezes promoted persisted slugs and requires a historical 308 alias on change', () => {
    expect(taxonomyPromotionPolicy.slug).toMatchObject({
      source: 'filters.slug', maxLength: 80, frozenAfterPromotion: true,
      changeRequiresHistoricalAlias: true, aliasRedirectStatus: 308,
    });
  });
});
