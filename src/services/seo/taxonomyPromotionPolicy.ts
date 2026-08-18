import policyJson from '../../../config/seo/taxonomy-promotion-policy.v1.json';

export const TAXONOMY_PROMOTION_POLICY_VERSION = 'taxonomy-promotion-policy.v1' as const;

export type TaxonomyPromotionPolicyV1 = {
  version: typeof TAXONOMY_PROMOTION_POLICY_VERSION;
  enforcement: false;
  calibrationRequired: true;
  slug: {
    source: 'filters.slug';
    maxLength: number;
    pattern: string;
    frozenAfterPromotion: true;
    changeRequiresHistoricalAlias: true;
    aliasRedirectStatus: 308;
  };
  blockedNames: string[];
  blockedTaxonomyLevels: string[];
  thresholds: Record<string, number | null>;
};

export const taxonomyPromotionPolicy = policyJson as TaxonomyPromotionPolicyV1;

export const validateTaxonomyPromotionPolicy = (value: unknown): value is TaxonomyPromotionPolicyV1 => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<TaxonomyPromotionPolicyV1>;
  return candidate.version === TAXONOMY_PROMOTION_POLICY_VERSION
    && candidate.enforcement === false
    && candidate.calibrationRequired === true
    && candidate.slug?.source === 'filters.slug'
    && Number.isInteger(candidate.slug.maxLength)
    && Number(candidate.slug.maxLength) === 80
    && candidate.slug.frozenAfterPromotion === true
    && candidate.slug.changeRequiresHistoricalAlias === true
    && candidate.slug.aliasRedirectStatus === 308
    && Array.isArray(candidate.blockedNames)
    && Array.isArray(candidate.blockedTaxonomyLevels);
};

if (!validateTaxonomyPromotionPolicy(taxonomyPromotionPolicy)) {
  throw new Error('Taxonomy Promotion Policy invalida.');
}
