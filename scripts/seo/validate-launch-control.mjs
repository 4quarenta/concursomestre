import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const pageMapPath = path.join(root, 'config', 'seo', 'seo-production-page-map.v1.json');
const structuralPath = path.join(root, 'config', 'seo', 'structural-route-policy.v1.json');
const pageMap = JSON.parse(fs.readFileSync(pageMapPath, 'utf8'));
const structural = JSON.parse(fs.readFileSync(structuralPath, 'utf8'));
const errors = [];

const simulate = (family, launchMode, ready = true) => {
  const reasonCodes = [];
  if (launchMode === 'PRELAUNCH') reasonCodes.push('indexability.launch_prelaunch');
  if (launchMode === 'GO_CANDIDATE') reasonCodes.push('indexability.launch_go_candidate');
  if (family.launchStatus !== 'ACTIVE') reasonCodes.push('indexability.launch_not_active');
  if (family.familyEligibility === 'PERMANENT_NOINDEX') reasonCodes.push('indexability.family_permanent_noindex');
  if (!ready) reasonCodes.push('indexability.instance_not_ready');
  const indexability = launchMode === 'PRODUCTION'
    && family.targetProductionIndexability === 'INDEX'
    && reasonCodes.length === 0
      ? 'INDEX'
      : 'NOINDEX';
  return { indexability, reasonCodes };
};

if (pageMap.version !== 'seo-production-page-map.v1') errors.push('invalid page map version');
if (pageMap.defaultLaunchMode !== 'PRELAUNCH') errors.push('default launch mode must be PRELAUNCH');

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

  const notReady = simulate(family, 'PRODUCTION', false);
  if (notReady.indexability !== 'NOINDEX' || !notReady.reasonCodes.includes('indexability.instance_not_ready')) {
    errors.push(`NOT_READY production gate failed for ${family.familyId}`);
  }
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
process.stdout.write(`SEO launch control: PASS (${pageMap.families.length} families, ${targetIndex} TARGET_INDEX, ${permanentNoindex} PERMANENT_NOINDEX)\n`);
