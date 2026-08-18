import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  applySeoLaunchModeToMetadata,
  evaluateSeoLaunchControl,
  getSeoLaunchMode,
  parseSeoLaunchMode,
  resolveSeoProductionFamily,
  resolveXRobotsTag,
  seoProductionPageMap,
} from './launchControl';

const family = (familyId: string) => seoProductionPageMap.families.find((item) => item.familyId === familyId)!;
const ready = { status: 'READY', reasonCodes: [] } as const;

afterEach(() => vi.unstubAllEnvs());

describe('SEO launch control', () => {
  it('fails safe to PRELAUNCH for missing or invalid configuration', () => {
    expect(parseSeoLaunchMode(undefined)).toBe('PRELAUNCH');
    expect(parseSeoLaunchMode('unknown')).toBe('PRELAUNCH');
    vi.stubEnv('SEO_LAUNCH_MODE', 'invalid');
    expect(getSeoLaunchMode()).toBe('PRELAUNCH');
  });

  it('keeps every family NOINDEX in PRELAUNCH', () => {
    seoProductionPageMap.families.forEach((item) => {
      const result = evaluateSeoLaunchControl({
        launchMode: 'PRELAUNCH',
        family: item,
        instanceReadiness: item.familyEligibility === 'PERMANENT_NOINDEX'
          ? { status: 'NOT_APPLICABLE', reasonCodes: ['instance_readiness.not_applicable'] }
          : ready,
        publicationAllowed: true,
        resolutionAction: 'render',
        httpStatus: 200,
        canonicalValid: true,
        qualityPass: true,
      });
      expect(result.indexability, item.familyId).toBe('NOINDEX');
      expect(result.sitemapEligible, item.familyId).toBe(false);
    });
  });

  it('does not mass-promote in GO_CANDIDATE', () => {
    const result = evaluateSeoLaunchControl({
      launchMode: 'GO_CANDIDATE', family: family('question_detail'), instanceReadiness: ready,
      publicationAllowed: true, resolutionAction: 'render', httpStatus: 200, canonicalValid: true, qualityPass: true,
    });
    expect(result).toMatchObject({ indexability: 'NOINDEX', sitemapEligible: false });
  });

  it('indexes only ready, production-eligible instances', () => {
    const base = {
      launchMode: 'PRODUCTION' as const,
      family: family('question_detail'),
      publicationAllowed: true,
      resolutionAction: 'render' as const,
      httpStatus: 200,
      canonicalValid: true,
      qualityPass: true,
    };
    expect(evaluateSeoLaunchControl({ ...base, instanceReadiness: ready })).toMatchObject({ indexability: 'INDEX', sitemapEligible: true });
    expect(evaluateSeoLaunchControl({
      ...base,
      instanceReadiness: { status: 'NOT_READY', reasonCodes: ['instance_readiness.pending'] },
    })).toMatchObject({ indexability: 'NOINDEX', sitemapEligible: false });
  });

  it('never promotes permanent NOINDEX families', () => {
    const result = evaluateSeoLaunchControl({
      launchMode: 'PRODUCTION', family: family('auth'),
      instanceReadiness: { status: 'NOT_APPLICABLE', reasonCodes: ['instance_readiness.not_applicable'] },
      publicationAllowed: true, resolutionAction: 'render', httpStatus: 200, canonicalValid: true, qualityPass: true,
    });
    expect(result).toMatchObject({ indexability: 'NOINDEX', sitemapEligible: false });
  });

  it('keeps pilot and planned families noindex until explicit activation', () => {
    const base = {
      launchMode: 'PRODUCTION' as const,
      instanceReadiness: ready,
      publicationAllowed: true,
      resolutionAction: 'render' as const,
      httpStatus: 200,
      canonicalValid: true,
      qualityPass: true,
    };

    expect(evaluateSeoLaunchControl({ ...base, family: family('discipline_detail') })).toMatchObject({
      indexability: 'NOINDEX',
      sitemapEligible: false,
      reasonCodes: expect.arrayContaining(['indexability.launch_not_active']),
    });
    expect(resolveXRobotsTag('/disciplinas/direito', new URLSearchParams(), 'PRODUCTION'))
      .toBe('noindex, follow');
    expect(resolveXRobotsTag('/orgaos/policia-federal', new URLSearchParams(), 'PRODUCTION'))
      .toBe('noindex, follow');
  });

  it('keeps canonical metadata while applying PRELAUNCH noindex', () => {
    const metadata = applySeoLaunchModeToMetadata({ alternates: { canonical: '/disciplinas/direito' } }, 'PRELAUNCH');
    expect(metadata.alternates).toEqual({ canonical: '/disciplinas/direito' });
    expect(metadata.robots).toMatchObject({ index: false, follow: true });
  });

  it('keeps pilot metadata noindex in PRODUCTION without changing canonical identity', () => {
    const metadata = applySeoLaunchModeToMetadata(
      { alternates: { canonical: '/disciplinas/direito' }, robots: { index: true, follow: true } },
      'PRODUCTION',
      '/disciplinas/direito',
    );
    expect(metadata.alternates).toEqual({ canonical: '/disciplinas/direito' });
    expect(metadata.robots).toMatchObject({ index: false, follow: true });
  });

  it('resolves permanent routes and functional query variations', () => {
    expect(resolveSeoProductionFamily('/setup').familyEligibility).toBe('PERMANENT_NOINDEX');
    expect(resolveXRobotsTag('/questoes', new URLSearchParams('materia=Direito'), 'PRODUCTION')).toBe('noindex, follow');
    expect(resolveXRobotsTag('/questoes/123/slug', new URLSearchParams(), 'PRODUCTION')).toBeNull();
    expect(resolveXRobotsTag('/questoes/123/slug', new URLSearchParams(), 'PRELAUNCH')).toBe('noindex, follow');
  });
});
