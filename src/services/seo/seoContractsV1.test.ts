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

import Ajv from 'ajv';
import { describe, expect, it } from 'vitest';

import publicationDecisionSchema from '../../../contracts/publication/publication-decision.v1.schema.json';
import contractFixtures from '../../../contracts/seo/fixtures/contract-fixtures.v1.json';
import reasonCodeSchema from '../../../contracts/seo/reason-codes.v1.json';
import seoLaunchControlSchema from '../../../contracts/seo/seo-launch-control.v1.schema.json';
import seoProductionPageMapSchema from '../../../contracts/seo/seo-production-page-map.v1.schema.json';
import seoDecisionSchema from '../../../contracts/seo/seo-decision.v1.schema.json';
import seoFactsSchema from '../../../contracts/seo/seo-facts.v1.schema.json';
import slugVectors from '../../../contracts/seo/slug-vectors.v1.json';
import qualityGateConfig from '../../../config/seo/quality-gates.v1.json';
import structuralRoutePolicy from '../../../config/seo/structural-route-policy.v1.json';
import seoProductionPageMap from '../../../config/seo/seo-production-page-map.v1.json';
import { validatePublicationDecision } from '../publication/publicationDecision';
import { validateQualityGatesConfig } from './qualityGateConfig';
import { validateSeoDecision } from './seoDecision';
import { validateSeoFacts } from './seoFacts';
import { buildContractSlugV1 } from './slugContract';
import { validateStructuralRoutePolicy } from './structuralRoutePolicy';

const ajv = new Ajv({ allErrors: true, jsonPointers: true });
ajv.addSchema(reasonCodeSchema);
ajv.addSchema(seoLaunchControlSchema);
const validateSeoDecisionSchema = ajv.compile(seoDecisionSchema);
const validateSeoFactsSchema = ajv.compile(seoFactsSchema);
const validatePublicationDecisionSchema = ajv.compile(publicationDecisionSchema);
const validateSeoProductionPageMapSchema = ajv.compile(seoProductionPageMapSchema);

describe('SEO v1 JSON Schemas', () => {
  it('accepts the versioned SEO Production Page Map', () => {
    expect(
      validateSeoProductionPageMapSchema(seoProductionPageMap),
      JSON.stringify(validateSeoProductionPageMapSchema.errors),
    ).toBe(true);
  });

  it.each(contractFixtures.seoDecision.valid)('accepts valid SeoDecision: $name', ({ value }) => {
    expect(validateSeoDecisionSchema(value), JSON.stringify(validateSeoDecisionSchema.errors)).toBe(true);
  });

  it.each(contractFixtures.seoDecision.invalid)('rejects invalid SeoDecision: $name', ({ value }) => {
    expect(validateSeoDecisionSchema(value)).toBe(false);
  });

  it.each(contractFixtures.publicationDecision.valid)('accepts valid PublicationDecision: $name', ({ value }) => {
    expect(validatePublicationDecisionSchema(value), JSON.stringify(validatePublicationDecisionSchema.errors)).toBe(true);
  });

  it.each(contractFixtures.publicationDecision.invalid)('rejects invalid PublicationDecision: $name', ({ value }) => {
    expect(validatePublicationDecisionSchema(value)).toBe(false);
  });

  it.each(contractFixtures.seoFacts.valid)('accepts valid SeoFacts variant: $name', ({ value }) => {
    expect(validateSeoFactsSchema(value), JSON.stringify(validateSeoFactsSchema.errors)).toBe(true);
  });

  it.each(contractFixtures.seoFacts.invalid)('rejects protected or presentation fields: $name', ({ value }) => {
    expect(validateSeoFactsSchema(value)).toBe(false);
  });
});

describe('SEO v1 TypeScript contract validators', () => {
  it.each(contractFixtures.seoDecision.valid)('accepts valid SeoDecision: $name', ({ value }) => {
    expect(validateSeoDecision(value)).toMatchObject({ valid: true, errors: [] });
  });

  it.each(contractFixtures.seoDecision.invalid)('rejects invalid SeoDecision: $name', ({ value }) => {
    expect(validateSeoDecision(value).valid).toBe(false);
  });

  it.each(contractFixtures.publicationDecision.valid)('accepts valid PublicationDecision: $name', ({ value }) => {
    expect(validatePublicationDecision(value)).toMatchObject({ valid: true, errors: [] });
  });

  it.each(contractFixtures.publicationDecision.invalid)('rejects invalid PublicationDecision: $name', ({ value }) => {
    expect(validatePublicationDecision(value).valid).toBe(false);
  });

  it.each(contractFixtures.seoFacts.valid)('accepts valid SeoFacts variant: $name', ({ value }) => {
    expect(validateSeoFacts(value)).toMatchObject({ valid: true, errors: [] });
  });

  it.each(contractFixtures.seoFacts.invalid)('rejects invalid SeoFacts variant: $name', ({ value }) => {
    expect(validateSeoFacts(value).valid).toBe(false);
  });

  it('rejects numeric HTTP statuses encoded as strings', () => {
    const fixture = structuredClone(contractFixtures.seoDecision.valid[0].value) as Record<string, unknown>;
    (fixture.resolution as Record<string, unknown>).httpStatus = '200';
    expect(validateSeoDecision(fixture).valid).toBe(false);
  });
});

describe('SEO v1 declarative policies', () => {
  it('keeps Quality Gates valid and disabled', () => {
    expect(validateQualityGatesConfig(qualityGateConfig)).toMatchObject({ valid: true, errors: [] });
    expect(qualityGateConfig.enforcement).toBe(false);
  });

  it('keeps Structural Route Policy valid and disabled', () => {
    expect(validateStructuralRoutePolicy(structuralRoutePolicy)).toMatchObject({ valid: true, errors: [] });
    expect(structuralRoutePolicy.enforcement).toBe(false);
    expect(structuralRoutePolicy.families).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'discipline_detail', defaultIndexability: 'INDEX' }),
      expect.objectContaining({ id: 'contest_hub', defaultIndexability: 'INDEX' }),
      expect.objectContaining({ id: 'blog_category', defaultIndexability: 'INDEX' }),
      expect.objectContaining({ id: 'blog_tag', defaultIndexability: 'NOINDEX' }),
      expect.objectContaining({ id: 'blog_author', defaultIndexability: 'NOINDEX' }),
      expect.objectContaining({ id: 'facet', defaultIndexability: 'NOINDEX' }),
    ]));
  });

  it('rejects publication policy concerns inside Quality Gates', () => {
    const config = structuredClone(qualityGateConfig) as typeof qualityGateConfig;
    config.resources.question.hardChecks[0] = {
      id: 'rights_clearance_check',
      reasonCode: 'quality.missing_required_content',
    };
    expect(validateQualityGatesConfig(config).valid).toBe(false);
  });

  it('rejects editorial entities inside Structural Route Policy', () => {
    const policy = structuredClone(structuralRoutePolicy) as Record<string, unknown>;
    policy.promotedEntities = ['direito-administrativo'];
    expect(validateStructuralRoutePolicy(policy).valid).toBe(false);
  });
});

describe('Slug Contract v1 normative vectors', () => {
  it.each(slugVectors.vectors)('$id', ({ input, expected, fallback }) => {
    expect(buildContractSlugV1(input, fallback)).toBe(expected);
  });
});
