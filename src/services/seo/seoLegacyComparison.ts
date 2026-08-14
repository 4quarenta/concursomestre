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

import type { SeoEnvelopeV1 } from './seoEnvelope';

export type SeoLegacyDivergenceCategory = 'indexability' | 'canonical' | 'slug' | 'publication' | 'quality';

export interface LegacySeoSnapshot {
  indexability?: 'INDEX' | 'NOINDEX';
  canonicalPath?: string | null;
  slug?: string | null;
  publicationStatus?: string | null;
  qualityStatus?: 'PASS' | 'FAIL' | 'NOT_EVALUATED' | null;
}

export interface SeoLegacyComparison {
  resourceType: string;
  resourceId: string;
  categories: SeoLegacyDivergenceCategory[];
  matches: boolean;
}

export const compareLegacySeoWithFuture = ({
  legacy,
  envelope,
}: {
  legacy: LegacySeoSnapshot;
  envelope: SeoEnvelopeV1;
}): SeoLegacyComparison => {
  const categories: SeoLegacyDivergenceCategory[] = [];
  const futureCanonical = envelope.seoDecision.canonical?.path ?? null;
  const futureSlug = envelope.seoDecision.canonical?.slug ?? null;

  if (legacy.indexability !== undefined && legacy.indexability !== envelope.seoDecision.indexability.status) {
    categories.push('indexability');
  }
  if (legacy.canonicalPath !== undefined && legacy.canonicalPath !== futureCanonical) {
    categories.push('canonical');
  }
  if (legacy.slug !== undefined && legacy.slug !== futureSlug) {
    categories.push('slug');
  }
  if (legacy.publicationStatus !== undefined && legacy.publicationStatus !== envelope.publicationDecision.status) {
    categories.push('publication');
  }
  if (legacy.qualityStatus !== undefined && legacy.qualityStatus !== envelope.seoDecision.quality.status) {
    categories.push('quality');
  }

  return {
    resourceType: envelope.seoFacts.resourceType,
    resourceId: envelope.seoDecision.resource.id,
    categories,
    matches: categories.length === 0,
  };
};
