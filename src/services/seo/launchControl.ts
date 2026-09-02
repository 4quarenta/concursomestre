import type { Metadata } from 'next';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import productionPageMapJson from '../../../config/seo/seo-production-page-map.v1.json';
import { classifyPublicRouteParameter } from '@services/routes/publicRoutes';
import { isQualityRequiredForFamily, isSeoRuntimeIndexingAllowed } from './runtimeEnvironment';

export const SEO_LAUNCH_MODES = ['PRELAUNCH', 'GO_CANDIDATE', 'PRODUCTION'] as const;
export const SEO_FAMILY_ELIGIBILITIES = ['INDEXABLE', 'CONDITIONAL', 'PERMANENT_NOINDEX'] as const;
export const SEO_INSTANCE_READINESS_STATUSES = ['READY', 'NOT_READY', 'NOT_APPLICABLE'] as const;
export const SEO_QUALITY_STATUSES = ['PASS', 'FAIL', 'NOT_EVALUATED'] as const;

export type SeoLaunchMode = (typeof SEO_LAUNCH_MODES)[number];
export type SeoFamilyEligibility = (typeof SEO_FAMILY_ELIGIBILITIES)[number];
export type SeoInstanceReadinessStatus = (typeof SEO_INSTANCE_READINESS_STATUSES)[number];
export type SeoQualityStatus = (typeof SEO_QUALITY_STATUSES)[number];
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
  qualityPass?: boolean;
  qualityStatus?: SeoQualityStatus;
  canonicalEnvironment?: boolean;
  productionActivationAllowed?: boolean;
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
  'instance_readiness.invalid_taxonomy_chain',
  'instance_readiness.orphan',
  'instance_readiness.cycle',
  'instance_readiness.wrong_parent_level',
  'instance_readiness.wrong_type',
  'instance_readiness.internal',
  'instance_readiness.placeholder',
  'instance_readiness.protected',
  'instance_readiness.canonical_invalid',
  'instance_readiness.not_evaluated',
  'instance_readiness.not_applicable',
  'instance_readiness.current_implementation_not_ready',
  'instance_readiness.invalid_definition',
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

const launchModeFilePath = (): string => process.env.SEO_LAUNCH_MODE_FILE
  || join(process.cwd(), 'backend', 'storage', 'runtime', 'seo-launch-mode.json');

export const getSeoLaunchMode = (): SeoLaunchMode => {
  const filePath = launchModeFilePath();
  if (existsSync(filePath)) {
    try {
      const payload = JSON.parse(readFileSync(filePath, 'utf8')) as { mode?: unknown };
      if (payload && Object.prototype.hasOwnProperty.call(payload, 'mode')) {
        return parseSeoLaunchMode(payload.mode);
      }
    } catch {
      return 'PRELAUNCH';
    }
  }
  return parseSeoLaunchMode(process.env.SEO_LAUNCH_MODE);
};

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
  qualityStatus = qualityPass === true ? 'PASS' : 'NOT_EVALUATED',
  canonicalEnvironment = false,
  productionActivationAllowed = false,
}: SeoLaunchEvaluationInput): SeoLaunchEvaluation => {
  const readinessErrors = validateInstanceReadiness(instanceReadiness);
  if (readinessErrors.length > 0) throw new Error(readinessErrors.join(' | '));

  const reasonCodes: string[] = [];
  if (!publicationAllowed) reasonCodes.push('indexability.non_public');
  if (isQualityRequiredForFamily(family.familyId) && qualityStatus === 'FAIL') {
    reasonCodes.push('indexability.quality_failed');
  } else if (isQualityRequiredForFamily(family.familyId) && qualityStatus !== 'PASS') {
    reasonCodes.push('indexability.quality_not_evaluated');
  }
  if (launchMode === 'PRELAUNCH') reasonCodes.push('indexability.launch_prelaunch');
  if (launchMode === 'GO_CANDIDATE') reasonCodes.push('indexability.launch_go_candidate');
  if (family.launchStatus !== 'ACTIVE') reasonCodes.push('indexability.launch_not_active');
  if (family.familyEligibility === 'PERMANENT_NOINDEX') reasonCodes.push('indexability.family_permanent_noindex');
  if (instanceReadiness.status !== 'READY') reasonCodes.push('indexability.instance_not_ready');
  if (!canonicalEnvironment) reasonCodes.push('indexability.non_canonical_environment');
  if (!productionActivationAllowed) reasonCodes.push('indexability.production_activation_missing');
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
  launchMode?: SeoLaunchMode,
  requestOrigin?: string,
): string | null => {
  const effectiveLaunchMode = launchMode ?? getSeoLaunchMode();
  const family = resolveSeoProductionFamily(pathname);
  if (family.familyEligibility === 'PERMANENT_NOINDEX'
    || family.launchStatus !== 'ACTIVE'
    || hasFunctionalSeoQuery(searchParams)) {
    return `noindex, ${family.robotsFollow ? 'follow' : 'nofollow'}`;
  }
  const environmentAllowed = launchMode !== undefined
    ? true
    : isSeoRuntimeIndexingAllowed(effectiveLaunchMode, requestOrigin);
  if (effectiveLaunchMode !== 'PRODUCTION' || !environmentAllowed) return 'noindex, follow';
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

const hasExplicitNoindex = (robots: Metadata['robots']): boolean => {
  if (typeof robots === 'string') return /(?:^|[\s,])noindex(?:$|[\s,])/i.test(robots);
  return Boolean(robots && typeof robots === 'object' && robots.index === false);
};

export const applySeoLaunchModeToMetadata = (
  metadata: Metadata,
  launchMode?: SeoLaunchMode,
  pathname?: string,
): Metadata => {
  const effectiveLaunchMode = launchMode ?? getSeoLaunchMode();
  const environmentAllowed = launchMode !== undefined
    ? true
    : isSeoRuntimeIndexingAllowed(effectiveLaunchMode);
  return effectiveLaunchMode === 'PRODUCTION'
    && environmentAllowed
    && (!pathname || (
      resolveSeoProductionFamily(pathname).launchStatus === 'ACTIVE'
      && resolveSeoProductionFamily(pathname).familyEligibility !== 'PERMANENT_NOINDEX'
    ))
    // Production relies on the crawler default when indexable. Omitting an
    // explicit `index` meta lets the host-aware X-Robots-Tag remain stricter
    // on preview or alternate hosts without emitting contradictory directives.
    ? (hasExplicitNoindex(metadata.robots) ? metadata : { ...metadata, robots: undefined })
    : { ...metadata, robots: launchModeRobots(true) };
};

export const isSeoProductionMode = (launchMode = getSeoLaunchMode()): boolean => (
  launchMode === 'PRODUCTION' && isSeoRuntimeIndexingAllowed(launchMode)
);
