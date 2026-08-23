import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const pageMapPath = path.join(root, 'config', 'seo', 'seo-production-page-map.v1.json');
const structuralPath = path.join(root, 'config', 'seo', 'structural-route-policy.v1.json');
const indexPolicyPath = path.join(root, 'config', 'seo', 'index-policy-phase-6.v1.json');
const fixturesPath = path.join(root, 'config', 'seo', 'index-policy-phase-6-fixtures.v1.json');
const graphPath = path.join(root, 'config', 'seo', 'internal-link-graph.v1.json');
const pageMap = JSON.parse(fs.readFileSync(pageMapPath, 'utf8'));
const structural = JSON.parse(fs.readFileSync(structuralPath, 'utf8'));
const indexPolicy = JSON.parse(fs.readFileSync(indexPolicyPath, 'utf8'));
const fixtures = JSON.parse(fs.readFileSync(fixturesPath, 'utf8'));
const graph = JSON.parse(fs.readFileSync(graphPath, 'utf8'));
const errors = [];

const qualityRequired = (familyId) => indexPolicy.quality.defaultPolicy === 'REQUIRED'
  || indexPolicy.quality.requiredFamilies.includes(familyId);

const simulate = (family, launchMode, options = {}) => {
  const {
    publicationAllowed = true,
    readiness = 'READY',
    qualityStatus = 'PASS',
    resolutionAction = 'render',
    httpStatus = 200,
    canonicalValid = true,
    canonicalEnvironment = true,
    productionActivationAllowed = true,
  } = options;
  const reasonCodes = [];
  if (!publicationAllowed) reasonCodes.push('indexability.non_public');
  if (launchMode === 'PRELAUNCH') reasonCodes.push('indexability.launch_prelaunch');
  if (launchMode === 'GO_CANDIDATE') reasonCodes.push('indexability.launch_go_candidate');
  if (family.launchStatus !== 'ACTIVE') reasonCodes.push('indexability.launch_not_active');
  if (family.familyEligibility === 'PERMANENT_NOINDEX') reasonCodes.push('indexability.family_permanent_noindex');
  if (readiness !== 'READY') reasonCodes.push('indexability.instance_not_ready');
  if (qualityRequired(family.familyId) && qualityStatus === 'FAIL') reasonCodes.push('indexability.quality_failed');
  if (qualityRequired(family.familyId) && !['PASS', 'FAIL'].includes(qualityStatus)) reasonCodes.push('indexability.quality_not_evaluated');
  if (!canonicalEnvironment) reasonCodes.push('indexability.non_canonical_environment');
  if (!productionActivationAllowed) reasonCodes.push('indexability.production_activation_missing');
  if (resolutionAction !== 'render' || httpStatus !== 200 || !canonicalValid) {
    reasonCodes.push('indexability.missing_canonical_identity');
  }
  const indexability = launchMode === 'PRODUCTION'
    && family.targetProductionIndexability === 'INDEX'
    && reasonCodes.length === 0
      ? 'INDEX'
      : 'NOINDEX';
  return {
    indexability,
    sitemapEligible: indexability === 'INDEX' && family.sitemapTarget === 'INCLUDE_WHEN_READY',
    reasonCodes,
  };
};

if (pageMap.version !== 'seo-production-page-map.v1') errors.push('invalid page map version');
if (pageMap.defaultLaunchMode !== 'PRELAUNCH') errors.push('default launch mode must be PRELAUNCH');
if (indexPolicy.version !== 'index-policy-phase-6.v1') errors.push('invalid Phase 6 index policy version');
if (indexPolicy.familyAuthority !== 'seo-production-page-map.v1') errors.push('Phase 6 family authority drift');
if (indexPolicy.canonicalOrigin !== 'https://concursomestre.com') errors.push('invalid canonical production origin');
if (indexPolicy.sitemap.indexPath !== '/sitemap.xml') errors.push('canonical sitemap index must be /sitemap.xml');
if (indexPolicy.sitemap.maxUrlsPerChild > 45000) errors.push('sitemap child limit must stay at or below 45000');
if (new Set([
  indexPolicy.runtime.deploymentEnvironmentVariable,
  indexPolicy.runtime.indexActivationVariable,
  indexPolicy.runtime.sitemapActivationVariable,
]).size !== 3) errors.push('runtime activation variables must be independent');

const ids = new Set();
for (const family of pageMap.families || []) {
  if (ids.has(family.familyId)) errors.push(`duplicate family ${family.familyId}`);
  ids.add(family.familyId);
  if (family.preLaunchIndexability !== 'NOINDEX') errors.push(`PRELAUNCH can index ${family.familyId}`);
  if (family.familyEligibility === 'PERMANENT_NOINDEX'
    && (family.targetProductionIndexability !== 'NOINDEX' || family.sitemapTarget !== 'EXCLUDE')) {
    errors.push(`permanent NOINDEX family can be promoted: ${family.familyId}`);
  }
  if (family.launchStatus === 'PLANNED' && family.currentState !== 'NOT_CREATED') {
    errors.push(`planned family is marked as created: ${family.familyId}`);
  }

  const prelaunch = simulate(family, 'PRELAUNCH');
  if (prelaunch.indexability !== 'NOINDEX' || !prelaunch.reasonCodes.includes('indexability.launch_prelaunch')) {
    errors.push(`inverse PRELAUNCH gate failed for ${family.familyId}`);
  }

  const production = simulate(family, 'PRODUCTION');
  const shouldIndex = family.launchStatus === 'ACTIVE'
    && family.targetProductionIndexability === 'INDEX'
    && family.familyEligibility !== 'PERMANENT_NOINDEX';
  if (shouldIndex && production.indexability !== 'INDEX') {
    errors.push(`active TARGET_INDEX family is unexpectedly NOINDEX: ${family.familyId}`);
  }
  if (!shouldIndex && production.indexability !== 'NOINDEX') {
    errors.push(`non-active or permanent family is unexpectedly INDEX: ${family.familyId}`);
  }
  if (production.indexability === 'NOINDEX' && production.reasonCodes.length === 0) {
    errors.push(`production NOINDEX has no reason code: ${family.familyId}`);
  }

  const notReady = simulate(family, 'PRODUCTION', { readiness: 'NOT_READY' });
  if (notReady.indexability !== 'NOINDEX' || !notReady.reasonCodes.includes('indexability.instance_not_ready')) {
    errors.push(`NOT_READY production gate failed for ${family.familyId}`);
  }
}

const familyById = new Map(pageMap.families.map((family) => [family.familyId, family]));
for (const fixture of fixtures.cases || []) {
  const fixtureFamily = familyById.get(fixture.familyId);
  if (!fixtureFamily) {
    errors.push(`fixture family missing from page map: ${fixture.familyId}`);
    continue;
  }
  const result = simulate(fixtureFamily, fixture.launchMode, fixture);
  if (result.indexability !== fixture.expectedIndexability || result.sitemapEligible !== fixture.expectedSitemap) {
    errors.push(`fixture mismatch: ${fixture.id}`);
  }
  if (result.indexability === 'NOINDEX' && result.reasonCodes.length === 0) {
    errors.push(`fixture NOINDEX without reason: ${fixture.id}`);
  }
}

const graphFamilies = new Set((graph.families || []).map((family) => family.familyId));
for (const familyId of graphFamilies) {
  if (!familyById.has(familyId)) errors.push(`graph family missing from page map: ${familyId}`);
}
for (const relation of graph.relations || []) {
  if (!graphFamilies.has(relation.sourceFamily)) errors.push(`graph relation has unknown source: ${relation.sourceFamily}`);
  if (!graphFamilies.has(relation.targetFamily)) errors.push(`graph relation has unknown target: ${relation.targetFamily}`);
}

for (const family of structural.families || []) {
  if (!ids.has(family.id) && !['private', 'admin', 'api'].includes(family.id)) {
    errors.push(`structural family missing from production map: ${family.id}`);
  }
}

if (errors.length > 0) {
  process.stderr.write(`SEO launch control: FAIL\n${errors.map((error) => `- ${error}`).join('\n')}\n`);
  process.exit(1);
}

const targetIndex = pageMap.families.filter((family) => family.targetProductionIndexability === 'INDEX').length;
const permanentNoindex = pageMap.families.filter((family) => family.familyEligibility === 'PERMANENT_NOINDEX').length;
process.stdout.write(`SEO launch control: PASS (${pageMap.families.length} mapped families, ${graphFamilies.size} graph families, ${targetIndex} TARGET_INDEX, ${permanentNoindex} PERMANENT_NOINDEX, ${fixtures.cases.length} fixtures)\n`);
