import indexPolicyJson from '../../../config/seo/index-policy-phase-6.v1.json';
import { getConfiguredSiteUrl } from '@/config/siteUrl';
import type { SeoLaunchMode } from './launchControl';

type IndexPolicyContract = {
  version: 'index-policy-phase-6.v1';
  canonicalOrigin: string;
  runtime: {
    deploymentEnvironmentVariable: string;
    productionEnvironmentValue: string;
    indexActivationVariable: string;
    sitemapActivationVariable: string;
    activationValue: string;
  };
  sitemap: {
    indexPath: string;
    legacyIndexPath: string;
    childPathPrefix: string;
    maxUrlsPerChild: number;
    maxUncompressedBytes: number;
    productionCacheSeconds: number;
  };
  quality: {
    defaultPolicy: 'REQUIRED' | 'NOT_REQUIRED';
    requiredFamilies: string[];
  };
  futureGates: string[];
};

const normalizeOrigin = (value: unknown): string | null => {
  try {
    const url = new URL(String(value || '').trim());
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    return url.origin.toLowerCase();
  } catch {
    return null;
  }
};

const validateContract = (value: unknown): IndexPolicyContract => {
  const candidate = value as Partial<IndexPolicyContract>;
  if (!candidate || candidate.version !== 'index-policy-phase-6.v1') {
    throw new Error('Index Policy Phase 6 contract is invalid.');
  }
  const canonicalOrigin = normalizeOrigin(candidate.canonicalOrigin);
  if (!canonicalOrigin || !canonicalOrigin.startsWith('https://')) {
    throw new Error('Index Policy canonical origin must be an absolute HTTPS origin.');
  }
  if (!candidate.runtime || !candidate.sitemap || !candidate.quality
    || !Array.isArray(candidate.quality.requiredFamilies)
    || !Array.isArray(candidate.futureGates)
    || candidate.sitemap.maxUrlsPerChild <= 0
    || candidate.sitemap.maxUrlsPerChild > 50000
    || candidate.sitemap.maxUncompressedBytes <= 0) {
    throw new Error('Index Policy Phase 6 settings are invalid.');
  }
  return candidate as IndexPolicyContract;
};

export const seoIndexPolicy = validateContract(indexPolicyJson);

export interface SeoRuntimeEnvironmentInput {
  launchMode: SeoLaunchMode;
  configuredOrigin?: string;
  requestOrigin?: string;
  deploymentEnvironment?: string;
  indexActivation?: string;
  sitemapActivation?: string;
  vercelEnvironment?: string;
}

export interface SeoRuntimeEnvironmentDecision {
  canonicalOrigin: string;
  configuredOriginCanonical: boolean;
  requestOriginCanonical: boolean;
  productionEnvironment: boolean;
  previewEnvironment: boolean;
  indexActivationConfirmed: boolean;
  sitemapActivationConfirmed: boolean;
  runtimeIndexingAllowed: boolean;
  sitemapPublicationAllowed: boolean;
  reasonCodes: string[];
}

const readEnvironment = (key: string): string => String(process.env[key] || '').trim();

export const evaluateSeoRuntimeEnvironment = ({
  launchMode,
  configuredOrigin = getConfiguredSiteUrl().origin,
  requestOrigin,
  deploymentEnvironment = readEnvironment(seoIndexPolicy.runtime.deploymentEnvironmentVariable),
  indexActivation = readEnvironment(seoIndexPolicy.runtime.indexActivationVariable),
  sitemapActivation = readEnvironment(seoIndexPolicy.runtime.sitemapActivationVariable),
  vercelEnvironment = readEnvironment('VERCEL_ENV'),
}: SeoRuntimeEnvironmentInput): SeoRuntimeEnvironmentDecision => {
  const canonicalOrigin = normalizeOrigin(seoIndexPolicy.canonicalOrigin)!;
  const normalizedConfiguredOrigin = normalizeOrigin(configuredOrigin);
  const normalizedRequestOrigin = requestOrigin === undefined ? canonicalOrigin : normalizeOrigin(requestOrigin);
  const configuredOriginCanonical = normalizedConfiguredOrigin === canonicalOrigin;
  const requestOriginCanonical = normalizedRequestOrigin === canonicalOrigin;
  const productionEnvironment = deploymentEnvironment.trim().toUpperCase()
    === seoIndexPolicy.runtime.productionEnvironmentValue;
  const previewEnvironment = vercelEnvironment !== '' && vercelEnvironment.toLowerCase() !== 'production';
  const indexActivationConfirmed = indexActivation.trim().toUpperCase()
    === seoIndexPolicy.runtime.activationValue;
  const sitemapActivationConfirmed = sitemapActivation.trim().toUpperCase()
    === seoIndexPolicy.runtime.activationValue;
  const reasonCodes: string[] = [];

  if (launchMode !== 'PRODUCTION') reasonCodes.push(`environment.launch_${launchMode.toLowerCase()}`);
  if (!configuredOriginCanonical) reasonCodes.push('environment.configured_origin_noncanonical');
  if (!requestOriginCanonical) reasonCodes.push('environment.request_origin_noncanonical');
  if (!productionEnvironment) reasonCodes.push('environment.not_production');
  if (previewEnvironment) reasonCodes.push('environment.preview');
  if (!indexActivationConfirmed) reasonCodes.push('environment.index_activation_missing');

  const runtimeIndexingAllowed = reasonCodes.length === 0;
  return {
    canonicalOrigin,
    configuredOriginCanonical,
    requestOriginCanonical,
    productionEnvironment,
    previewEnvironment,
    indexActivationConfirmed,
    sitemapActivationConfirmed,
    runtimeIndexingAllowed,
    sitemapPublicationAllowed: runtimeIndexingAllowed && sitemapActivationConfirmed,
    reasonCodes: sitemapActivationConfirmed
      ? reasonCodes
      : [...reasonCodes, 'environment.sitemap_activation_missing'],
  };
};

export const getSeoRuntimeEnvironment = (
  launchMode: SeoLaunchMode,
  requestOrigin?: string,
): SeoRuntimeEnvironmentDecision => evaluateSeoRuntimeEnvironment({ launchMode, requestOrigin });

export const isSeoRuntimeIndexingAllowed = (launchMode: SeoLaunchMode, requestOrigin?: string): boolean => (
  getSeoRuntimeEnvironment(launchMode, requestOrigin).runtimeIndexingAllowed
);

export const isProductionSitemapPublicationAllowed = (
  launchMode: SeoLaunchMode,
  requestOrigin?: string,
): boolean => getSeoRuntimeEnvironment(launchMode, requestOrigin).sitemapPublicationAllowed;

export const isQualityRequiredForFamily = (familyId: string): boolean => (
  seoIndexPolicy.quality.requiredFamilies.includes(familyId)
  || seoIndexPolicy.quality.defaultPolicy === 'REQUIRED'
);
