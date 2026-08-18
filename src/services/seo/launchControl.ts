import type { Metadata } from 'next';
import productionPageMapJson from '../../../config/seo/seo-production-page-map.v1.json';
import { classifyPublicRouteParameter } from '@services/routes/publicRoutes';

export const SEO_LAUNCH_MODES = ['PRELAUNCH', 'GO_CANDIDATE', 'PRODUCTION'] as const;
export const SEO_FAMILY_ELIGIBILITIES = ['INDEXABLE', 'CONDITIONAL', 'PERMANENT_NOINDEX'] as const;
export const SEO_INSTANCE_READINESS_STATUSES = ['READY', 'NOT_READY', 'NOT_APPLICABLE'] as const;

export type SeoLaunchMode = (typeof SEO_LAUNCH_MODES)[number];
export type SeoFamilyEligibility = (typeof SEO_FAMILY_ELIGIBILITIES)[number];
export type SeoInstanceReadinessStatus = (typeof SEO_INSTANCE_READINESS_STATUSES)[number];
export type SeoRuntimeIndexability = 'INDEX' | 'NOINDEX';

export interface SeoInstanceReadiness {
  status: SeoInstanceReadinessStatus;
  reasonCodes: string[];
}

export interface SeoProductionFamily {
  familyId: string;
  routeFamily: string;
  routePatterns: string[];
  currentState: 'INDEX' | 'NOINDEX' | 'MIXED' | 'NOT_CREATED' | 'REDIRECT' | 'PRIVATE';
  familyEligibility: SeoFamilyEligibility;
  preLaunchIndexability: 'NOINDEX';
  targetProductionIndexability: SeoRuntimeIndexability;
  sitemapTarget: 'INCLUDE_WHEN_READY' | 'EXCLUDE';
  instanceReadinessRule: string;
  launchStatus: 'ACTIVE' | 'PILOT' | 'PLANNED' | 'PERMANENT';
  robotsFollow: boolean;
  requirements?: string[];
}

export interface SeoProductionPageMapV1 {
  version: 'seo-production-page-map.v1';
  defaultLaunchMode: 'PRELAUNCH';
  families: SeoProductionFamily[];
}

export interface SeoLaunchEvaluationInput {
  launchMode?: SeoLaunchMode;
  family: SeoProductionFamily;
  instanceReadiness: SeoInstanceReadiness;
  publicationAllowed: boolean;
  resolutionAction: 'render' | 'redirect' | 'not_found' | 'gone';
  httpStatus: number;
  canonicalValid: boolean;
  qualityPass: boolean;
}

export interface SeoLaunchEvaluation {
  indexability: SeoRuntimeIndexability;
  sitemapEligible: boolean;
  reasonCodes: string[];
}

const INSTANCE_REASON_CODES = new Set([
  'instance_readiness.entity_missing',
  'instance_readiness.invalid_slug',
  'instance_readiness.pending',
  'instance_readiness.publication_blocked',
  'instance_readiness.invalid_hierarchy',
  'instance_readiness.protected',
  'instance_readiness.canonical_invalid',
  'instance_readiness.not_evaluated',
  'instance_readiness.not_applicable',
  'instance_readiness.current_implementation_not_ready',
]);

const validateProductionPageMap = (value: unknown): SeoProductionPageMapV1 => {
  if (!value || typeof value !== 'object') throw new Error('SEO Production Page Map must be an object.');
  const candidate = value as Partial<SeoProductionPageMapV1>;
  if (candidate.version !== 'seo-production-page-map.v1' || candidate.defaultLaunchMode !== 'PRELAUNCH') {
    throw new Error('SEO Production Page Map version/default is invalid.');
  }
  if (!Array.isArray(candidate.families) || candidate.families.length === 0) {
    throw new Error('SEO Production Page Map families are missing.');
  }

  const ids = new Set<string>();
  candidate.families.forEach((family) => {
    if (!family || typeof family !== 'object' || !/^[a-z][a-z0-9_]*$/.test(String(family.familyId || ''))) {
      throw new Error('SEO Production Page Map contains an invalid family.');
    }
    if (ids.has(family.familyId)) throw new Error(`Duplicate SEO production family: ${family.familyId}.`);
    ids.add(family.familyId);
    if (!SEO_FAMILY_ELIGIBILITIES.includes(family.familyEligibility)) {
      throw new Error(`Invalid eligibility for ${family.familyId}.`);
    }
    if (!Array.isArray(family.routePatterns) || family.routePatterns.length === 0
      || family.routePatterns.some((pattern) => typeof pattern !== 'string' || !pattern.startsWith('/'))) {
      throw new Error(`Invalid route patterns for ${family.familyId}.`);
    }
    if (family.preLaunchIndexability !== 'NOINDEX') {
      throw new Error(`${family.familyId} is not fail-safe in PRELAUNCH.`);
    }
    if (family.familyEligibility === 'PERMANENT_NOINDEX'
      && (family.targetProductionIndexability !== 'NOINDEX' || family.sitemapTarget !== 'EXCLUDE')) {
      throw new Error(`${family.familyId} can promote a permanent NOINDEX family.`);
    }
  });

  return candidate as SeoProductionPageMapV1;
};

export const seoProductionPageMap = validateProductionPageMap(productionPageMapJson);

export const parseSeoLaunchMode = (value: unknown): SeoLaunchMode => {
  const normalized = String(value || '').trim().toUpperCase();
  return SEO_LAUNCH_MODES.includes(normalized as SeoLaunchMode)
    ? normalized as SeoLaunchMode
    : seoProductionPageMap.defaultLaunchMode;
};

export const getSeoLaunchMode = (): SeoLaunchMode => parseSeoLaunchMode(process.env.SEO_LAUNCH_MODE);

export const validateInstanceReadiness = (value: SeoInstanceReadiness): string[] => {
  const errors: string[] = [];
  if (!SEO_INSTANCE_READINESS_STATUSES.includes(value.status)) errors.push('Invalid instance readiness status.');
  if (!Array.isArray(value.reasonCodes)) return [...errors, 'Instance readiness reasonCodes must be an array.'];
  if (new Set(value.reasonCodes).size !== value.reasonCodes.length) errors.push('Instance readiness reasonCodes must be unique.');
  if (value.reasonCodes.some((code) => !INSTANCE_REASON_CODES.has(code))) errors.push('Unknown instance readiness reason code.');
  if (value.status === 'READY' && value.reasonCodes.length > 0) errors.push('READY cannot have blocking reason codes.');
  if (value.status !== 'READY' && value.reasonCodes.length === 0) errors.push(`${value.status} requires a reason code.`);
  return errors;
};

export const evaluateSeoLaunchControl = ({
  launchMode = getSeoLaunchMode(),
  family,
  instanceReadiness,
  publicationAllowed,
  resolutionAction,
  httpStatus,
  canonicalValid,
  qualityPass,
}: SeoLaunchEvaluationInput): SeoLaunchEvaluation => {
  const readinessErrors = validateInstanceReadiness(instanceReadiness);
  if (readinessErrors.length > 0) throw new Error(readinessErrors.join(' | '));

  const reasonCodes: string[] = [];
  if (!publicationAllowed) reasonCodes.push('indexability.non_public');
  if (!qualityPass) reasonCodes.push('indexability.quality_not_evaluated');
  if (launchMode === 'PRELAUNCH') reasonCodes.push('indexability.launch_prelaunch');
  if (launchMode === 'GO_CANDIDATE') reasonCodes.push('indexability.launch_go_candidate');
  if (family.launchStatus !== 'ACTIVE') reasonCodes.push('indexability.launch_not_active');
  if (family.familyEligibility === 'PERMANENT_NOINDEX') reasonCodes.push('indexability.family_permanent_noindex');
  if (instanceReadiness.status !== 'READY') reasonCodes.push('indexability.instance_not_ready');
  if (resolutionAction !== 'render' || httpStatus !== 200 || !canonicalValid) {
    reasonCodes.push('indexability.missing_canonical_identity');
  }

  const uniqueReasons = [...new Set(reasonCodes)];
  const indexability = uniqueReasons.length === 0
    && launchMode === 'PRODUCTION'
    && family.targetProductionIndexability === 'INDEX'
      ? 'INDEX'
      : 'NOINDEX';

  return {
    indexability,
    sitemapEligible: indexability === 'INDEX'
      && family.sitemapTarget === 'INCLUDE_WHEN_READY'
      && resolutionAction === 'render'
      && httpStatus === 200
      && canonicalValid,
    reasonCodes: uniqueReasons,
  };
};

const patternToRegex = (pattern: string): RegExp => {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const wildcarded = escaped
    .replace(/\\\{\\\*[^}]+\\\}/g, '.*')
    .replace(/\\\{[^}]+\\\}/g, '[^/]+');
  return new RegExp(`^${wildcarded}/?$`);
};

export const resolveSeoProductionFamily = (pathname: string): SeoProductionFamily => {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  const match = seoProductionPageMap.families.find((family) => (
    family.familyId !== 'not_found'
    && family.routePatterns.some((pattern) => patternToRegex(pattern).test(normalized))
  ));
  return match || seoProductionPageMap.families.find((family) => family.familyId === 'not_found')!;
};

export const hasFunctionalSeoQuery = (searchParams: URLSearchParams): boolean => (
  Array.from(searchParams.keys()).some((parameter) => {
    const classification = classifyPublicRouteParameter(parameter);
    return classification !== 'tracking' && classification !== 'internal';
  })
);

export const resolveXRobotsTag = (
  pathname: string,
  searchParams: URLSearchParams,
  launchMode = getSeoLaunchMode(),
): string | null => {
  const family = resolveSeoProductionFamily(pathname);
  if (family.familyEligibility === 'PERMANENT_NOINDEX'
    || family.launchStatus !== 'ACTIVE'
    || hasFunctionalSeoQuery(searchParams)) {
    return `noindex, ${family.robotsFollow ? 'follow' : 'nofollow'}`;
  }
  if (launchMode !== 'PRODUCTION') return 'noindex, follow';
  return null;
};

export const launchModeRobots = (follow = true): NonNullable<Metadata['robots']> => ({
  index: false,
  follow,
  noarchive: true,
  googleBot: {
    index: false,
    follow,
    noarchive: true,
  },
});

export const applySeoLaunchModeToMetadata = (
  metadata: Metadata,
  launchMode = getSeoLaunchMode(),
  pathname?: string,
): Metadata => (
  launchMode === 'PRODUCTION'
    && (!pathname || (
      resolveSeoProductionFamily(pathname).launchStatus === 'ACTIVE'
      && resolveSeoProductionFamily(pathname).familyEligibility !== 'PERMANENT_NOINDEX'
    ))
    ? metadata
    : { ...metadata, robots: launchModeRobots(true) }
);

export const isSeoProductionMode = (launchMode = getSeoLaunchMode()): boolean => launchMode === 'PRODUCTION';
