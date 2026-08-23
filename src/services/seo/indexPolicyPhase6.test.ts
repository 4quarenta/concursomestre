import { afterEach, describe, expect, it, vi } from 'vitest';
import fixturesJson from '../../../config/seo/index-policy-phase-6-fixtures.v1.json';
import {
  evaluateSeoLaunchControl,
  resolveXRobotsTag,
  seoProductionPageMap,
  type SeoLaunchMode,
  type SeoQualityStatus,
} from './launchControl';
import { evaluateSeoRuntimeEnvironment, seoIndexPolicy } from './runtimeEnvironment';

type FixtureCase = {
  id: string;
  familyId: string;
  launchMode: SeoLaunchMode;
  publicationAllowed: boolean;
  readiness: 'READY' | 'NOT_READY' | 'NOT_APPLICABLE';
  qualityStatus: SeoQualityStatus;
  resolutionAction: 'render' | 'redirect' | 'not_found' | 'gone';
  httpStatus: number;
  canonicalValid: boolean;
  canonicalEnvironment: boolean;
  productionActivationAllowed: boolean;
  expectedIndexability: 'INDEX' | 'NOINDEX';
  expectedSitemap: boolean;
};

const fixtures = fixturesJson as { version: string; cases: FixtureCase[] };
const family = (id: string) => seoProductionPageMap.families.find((item) => item.familyId === id)!;

afterEach(() => vi.unstubAllEnvs());

describe('Phase 6 unified index policy', () => {
  it('keeps the executable fixture matrix in parity with launch control', () => {
    expect(fixtures.version).toBe('index-policy-phase-6-fixtures.v1');
    fixtures.cases.forEach((fixture) => {
      const result = evaluateSeoLaunchControl({
        launchMode: fixture.launchMode,
        family: family(fixture.familyId),
        instanceReadiness: {
          status: fixture.readiness,
          reasonCodes: fixture.readiness === 'READY'
            ? []
            : [fixture.readiness === 'NOT_APPLICABLE'
              ? 'instance_readiness.not_applicable'
              : 'instance_readiness.not_evaluated'],
        },
        publicationAllowed: fixture.publicationAllowed,
        resolutionAction: fixture.resolutionAction,
        httpStatus: fixture.httpStatus,
        canonicalValid: fixture.canonicalValid,
        qualityStatus: fixture.qualityStatus,
        canonicalEnvironment: fixture.canonicalEnvironment,
        productionActivationAllowed: fixture.productionActivationAllowed,
      });
      expect(result.indexability, fixture.id).toBe(fixture.expectedIndexability);
      expect(result.sitemapEligible, fixture.id).toBe(fixture.expectedSitemap);
      if (result.indexability === 'NOINDEX') expect(result.reasonCodes.length, fixture.id).toBeGreaterThan(0);
    });
  });

  it('fails closed for every mapped family before PRODUCTION', () => {
    for (const launchMode of ['PRELAUNCH', 'GO_CANDIDATE'] as const) {
      seoProductionPageMap.families.forEach((item) => {
        const result = evaluateSeoLaunchControl({
          launchMode,
          family: item,
          instanceReadiness: item.familyEligibility === 'PERMANENT_NOINDEX'
            ? { status: 'NOT_APPLICABLE', reasonCodes: ['instance_readiness.not_applicable'] }
            : { status: 'READY', reasonCodes: [] },
          publicationAllowed: true,
          resolutionAction: 'render',
          httpStatus: 200,
          canonicalValid: true,
          qualityStatus: 'PASS',
          canonicalEnvironment: true,
          productionActivationAllowed: true,
        });
        expect(result.indexability, `${launchMode}:${item.familyId}`).toBe('NOINDEX');
        expect(result.sitemapEligible, `${launchMode}:${item.familyId}`).toBe(false);
      });
    }
  });

  it('requires all independent production environment gates', () => {
    const allowed = evaluateSeoRuntimeEnvironment({
      launchMode: 'PRODUCTION',
      configuredOrigin: seoIndexPolicy.canonicalOrigin,
      requestOrigin: seoIndexPolicy.canonicalOrigin,
      deploymentEnvironment: 'PRODUCTION',
      indexActivation: 'CONFIRMED',
      sitemapActivation: 'CONFIRMED',
      vercelEnvironment: 'production',
    });
    expect(allowed).toMatchObject({ runtimeIndexingAllowed: true, sitemapPublicationAllowed: true });

    const variants = [
      { requestOrigin: 'https://preview.example.com' },
      { configuredOrigin: 'https://preview.example.com' },
      { deploymentEnvironment: 'STAGING' },
      { indexActivation: '' },
      { vercelEnvironment: 'preview' },
    ];
    variants.forEach((variant) => {
      expect(evaluateSeoRuntimeEnvironment({
        launchMode: 'PRODUCTION',
        configuredOrigin: seoIndexPolicy.canonicalOrigin,
        requestOrigin: seoIndexPolicy.canonicalOrigin,
        deploymentEnvironment: 'PRODUCTION',
        indexActivation: 'CONFIRMED',
        sitemapActivation: 'CONFIRMED',
        vercelEnvironment: 'production',
        ...variant,
      }).runtimeIndexingAllowed).toBe(false);
    });
  });

  it('keeps query variants and permanent families noindex on an otherwise eligible host', () => {
    expect(resolveXRobotsTag('/questoes', new URLSearchParams('materia=direito'), 'PRODUCTION'))
      .toBe('noindex, follow');
    expect(resolveXRobotsTag('/marketplace', new URLSearchParams(), 'PRODUCTION'))
      .toBe('noindex, follow');
    expect(resolveXRobotsTag('/blog/tag/seo', new URLSearchParams(), 'PRODUCTION'))
      .toBe('noindex, follow');
  });
});
