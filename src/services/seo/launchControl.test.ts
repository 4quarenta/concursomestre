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

  it('promotes ready practice taxonomy families only after explicit activation in PRODUCTION', () => {
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
      indexability: 'INDEX',
      sitemapEligible: true,
    });
    expect(evaluateSeoLaunchControl({ ...base, family: family('topic_detail') }))
      .toMatchObject({ indexability: 'INDEX', sitemapEligible: true });
    expect(evaluateSeoLaunchControl({ ...base, family: family('subject_detail') }))
      .toMatchObject({ indexability: 'INDEX', sitemapEligible: true });
    expect(resolveXRobotsTag('/disciplinas/direito', new URLSearchParams(), 'PRODUCTION'))
      .toBeNull();
    expect(resolveXRobotsTag('/topicos/controle', new URLSearchParams(), 'PRELAUNCH'))
      .toBe('noindex, follow');
  });

  it('promotes ready organization routes only in PRODUCTION', () => {
    const base = {
      launchMode: 'PRODUCTION' as const,
      instanceReadiness: ready,
      publicationAllowed: true,
      resolutionAction: 'render' as const,
      httpStatus: 200,
      canonicalValid: true,
      qualityPass: true,
    };
    expect(evaluateSeoLaunchControl({ ...base, family: family('organizations_hub') }))
      .toMatchObject({ indexability: 'INDEX', sitemapEligible: true });
    expect(evaluateSeoLaunchControl({ ...base, family: family('organization_detail') }))
      .toMatchObject({ indexability: 'INDEX', sitemapEligible: true });
    expect(evaluateSeoLaunchControl({
      ...base,
      family: family('organization_detail'),
      instanceReadiness: { status: 'NOT_READY', reasonCodes: ['instance_readiness.pending'] },
    })).toMatchObject({ indexability: 'NOINDEX', sitemapEligible: false });
    expect(resolveXRobotsTag('/orgaos/policia-federal', new URLSearchParams(), 'PRODUCTION')).toBeNull();
    expect(resolveXRobotsTag('/orgaos/policia-federal', new URLSearchParams(), 'PRELAUNCH')).toBe('noindex, follow');
  });

  it('keeps contest families protected until PRODUCTION and excludes unpublished instances', () => {
    const ready = { status: 'READY' as const, reasonCodes: [] };
    const input = {
      launchMode: 'PRELAUNCH' as const,
      instanceReadiness: ready,
      publicationAllowed: true,
      resolutionAction: 'render' as const,
      httpStatus: 200,
      canonicalValid: true,
      qualityPass: true,
    };
    for (const id of ['contest_hub', 'contest_detail', 'open_contests']) {
      expect(evaluateSeoLaunchControl({ ...input, family: family(id) }).indexability).toBe('NOINDEX');
      expect(evaluateSeoLaunchControl({ ...input, launchMode: 'PRODUCTION', family: family(id) }).indexability).toBe('INDEX');
    }
    expect(evaluateSeoLaunchControl({ ...input, launchMode: 'PRODUCTION', family: family('contest_detail'), publicationAllowed: false }).sitemapEligible).toBe(false);
  });

  it('promotes READY career and position families only in PRODUCTION', () => {
    const input = {
      launchMode: 'PRODUCTION' as const, instanceReadiness: ready, publicationAllowed: true,
      resolutionAction: 'render' as const, httpStatus: 200, canonicalValid: true, qualityPass: true,
    };
    for (const id of ['careers_hub', 'career_detail', 'positions_hub', 'position_detail']) {
      expect(evaluateSeoLaunchControl({ ...input, family: family(id) })).toMatchObject({ indexability: 'INDEX', sitemapEligible: true });
      expect(evaluateSeoLaunchControl({ ...input, launchMode: 'PRELAUNCH', family: family(id) })).toMatchObject({ indexability: 'NOINDEX', sitemapEligible: false });
    }
    expect(evaluateSeoLaunchControl({ ...input, family: family('position_detail'), instanceReadiness: { status: 'NOT_READY', reasonCodes: ['instance_readiness.placeholder'] } })).toMatchObject({ indexability: 'NOINDEX', sitemapEligible: false });
    expect(resolveXRobotsTag('/cargos/auditor-fiscal', new URLSearchParams(), 'PRELAUNCH')).toBe('noindex, follow');
  });

  it('promotes only READY public simulations in PRODUCTION', () => {
    const input = {
      launchMode: 'PRODUCTION' as const, instanceReadiness: ready, publicationAllowed: true,
      resolutionAction: 'render' as const, httpStatus: 200, canonicalValid: true, qualityPass: true,
    };
    for (const id of ['simulations_hub', 'simulation_detail']) {
      expect(evaluateSeoLaunchControl({ ...input, family: family(id) })).toMatchObject({ indexability: 'INDEX', sitemapEligible: true });
      expect(evaluateSeoLaunchControl({ ...input, launchMode: 'PRELAUNCH', family: family(id) })).toMatchObject({ indexability: 'NOINDEX', sitemapEligible: false });
    }
    expect(evaluateSeoLaunchControl({ ...input, family: family('simulation_detail'), instanceReadiness: { status: 'NOT_READY', reasonCodes: ['instance_readiness.invalid_definition'] } })).toMatchObject({ indexability: 'NOINDEX', sitemapEligible: false });
    expect(resolveXRobotsTag('/simulados/simulado-publico', new URLSearchParams(), 'PRELAUNCH')).toBe('noindex, follow');
    expect(resolveXRobotsTag('/simulados', new URLSearchParams('busca=fiscal'), 'PRODUCTION')).toBe('noindex, follow');
  });

  it('keeps canonical metadata while applying PRELAUNCH noindex', () => {
    const metadata = applySeoLaunchModeToMetadata({ alternates: { canonical: '/disciplinas/direito' } }, 'PRELAUNCH');
    expect(metadata.alternates).toEqual({ canonical: '/disciplinas/direito' });
    expect(metadata.robots).toMatchObject({ index: false, follow: true });
  });

  it('promotes ready discipline metadata in PRODUCTION without changing canonical identity', () => {
    const metadata = applySeoLaunchModeToMetadata(
      { alternates: { canonical: '/disciplinas/direito' }, robots: { index: true, follow: true } },
      'PRODUCTION',
      '/disciplinas/direito',
    );
    expect(metadata.alternates).toEqual({ canonical: '/disciplinas/direito' });
    expect(metadata.robots).toMatchObject({ index: true, follow: true });
  });

  it('resolves permanent routes and functional query variations', () => {
    expect(resolveSeoProductionFamily('/setup').familyEligibility).toBe('PERMANENT_NOINDEX');
    expect(resolveXRobotsTag('/questoes', new URLSearchParams('materia=Direito'), 'PRODUCTION')).toBe('noindex, follow');
    expect(resolveXRobotsTag('/questoes/123/slug', new URLSearchParams(), 'PRODUCTION')).toBeNull();
    expect(resolveXRobotsTag('/questoes/123/slug', new URLSearchParams(), 'PRELAUNCH')).toBe('noindex, follow');
  });
});
