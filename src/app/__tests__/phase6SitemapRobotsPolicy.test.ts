import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET as getRobots } from '../robots.txt/route';
import { GET as getSitemap } from '../sitemap.xml/route';
import { GET as getLegacySitemap } from '../sitemap-index.xml/route';
import { GET as getSitemapChild } from '../sitemaps/[filename]/route';

const directories: string[] = [];
const stateFiles: string[] = [];

const activateProduction = () => {
  vi.stubEnv('SEO_LAUNCH_MODE', 'PRODUCTION');
  vi.stubEnv('SEO_DEPLOYMENT_ENVIRONMENT', 'PRODUCTION');
  vi.stubEnv('SEO_PRODUCTION_INDEXING', 'CONFIRMED');
  vi.stubEnv('SEO_PRODUCTION_SITEMAP', 'CONFIRMED');
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://concursomestre.com');
};

const createArtifacts = async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'cm-phase6-route-'));
  directories.push(directory);
  vi.stubEnv('SITEMAP_OUTPUT_DIR', directory);
  const files = {
    'sitemap.xml': '<sitemapindex><sitemap><loc>https://concursomestre.com/sitemaps/questions-00001.xml</loc></sitemap></sitemapindex>',
    'questions-00001.xml': '<urlset/>',
  };
  const manifestFiles = Object.entries(files).map(([name, body]) => ({
    name, sha256: createHash('sha256').update(body, 'utf8').digest('hex'), size: Buffer.byteLength(body),
  })).sort((a, b) => a.name.localeCompare(b.name));
  const datasetFingerprint = createHash('sha256').update('eligible-db-rows', 'utf8').digest('hex');
  const datasetRevisionToken = createHash('sha256').update('dataset-revision:1', 'utf8').digest('hex');
  vi.stubEnv('SITEMAP_TEST_CURRENT_REVISION_TOKEN', datasetRevisionToken);
  const artifactFingerprint = createHash('sha256').update(JSON.stringify(manifestFiles), 'utf8').digest('hex');
  const releaseId = createHash('sha256').update(['sitemap-release-manifest.v1', datasetFingerprint, artifactFingerprint].join('\0')).digest('hex');
  const manifest = JSON.stringify({
    version: 'sitemap-release-manifest.v1', artifactStateVersion: 'database-driven-sitemap-state.v4', releaseId,
    logicalDatasetFingerprint: datasetFingerprint, physicalSetFingerprint: artifactFingerprint, files: manifestFiles,
    indexReferences: ['questions-00001.xml'],
  });
  const manifestHash = createHash('sha256').update(manifest, 'utf8').digest('hex');
  await Promise.all(Object.entries(files).map(([name, body]) => writeFile(path.join(directory, name), body, 'utf8')));
  await writeFile(path.join(directory, 'sitemap-release-manifest.json'), manifest, 'utf8');
  await writeFile(path.join(directory, 'sitemap-status.json'), JSON.stringify({
    artifactSet: 'canonical-sitemap-index',
    indexPolicyVersion: 'index-policy-phase-6.v1',
    canonicalBaseUrl: 'https://concursomestre.com',
    artifactStateVersion: 'database-driven-sitemap-state.v4',
    logicalDatasetVersion: 'eligible-sitemap-dataset.v2',
    datasetRevisionVersion: 'sitemap-dataset-revision.v1',
    datasetRevisionToken,
    releaseManifestVersion: 'sitemap-release-manifest.v1',
    releaseManifestFile: 'sitemap-release-manifest.json',
    eligibleDatasetFingerprint: datasetFingerprint,
    artifactFingerprint,
    releaseId,
    manifestHash,
    validation: { valid: true },
  }), 'utf8');
  const statePath = path.join(path.dirname(directory), `.${path.basename(directory)}-publication-state.json`);
  stateFiles.push(statePath);
  await writeFile(statePath, JSON.stringify({
    version: 'database-driven-sitemap-state.v4',
    state: 'CURRENT',
    eligibleDatasetFingerprint: datasetFingerprint,
    datasetRevisionToken,
    artifactFingerprint,
    releaseId,
    manifestHash,
  }), 'utf8');
};

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
  await Promise.all(stateFiles.splice(0).map((statePath) => rm(statePath, { force: true })));
});

describe('Phase 6 sitemap and robots publication', () => {
  it('keeps PRELAUNCH crawlable for noindex discovery without sitemap disclosure', async () => {
    vi.stubEnv('SEO_LAUNCH_MODE', 'PRELAUNCH');
    const response = await getRobots(new Request('https://concursomestre.com/robots.txt'));
    const body = await response.text();
    expect(body).toContain('Allow: /');
    expect(body).not.toContain('Disallow: /\n');
    expect(body).not.toContain('Sitemap:');
    expect((await getSitemap(new Request('https://concursomestre.com/sitemap.xml'))).status).toBe(503);
  });

  it('publishes one canonical index and its validated children after all gates', async () => {
    activateProduction();
    await createArtifacts();
    const robots = await (await getRobots(new Request('https://concursomestre.com/robots.txt'))).text();
    expect(robots.match(/^Sitemap:/gm)).toHaveLength(1);
    expect(robots).toContain('https://concursomestre.com/sitemap.xml');
    expect((await getSitemap(new Request('https://concursomestre.com/sitemap.xml'))).status).toBe(200);
    expect((await getSitemapChild(
      new Request('https://concursomestre.com/sitemaps/questions-00001.xml'),
      { params: Promise.resolve({ filename: 'questions-00001.xml' }) },
    )).status).toBe(200);
    const legacy = await getLegacySitemap(new Request('https://concursomestre.com/sitemap-index.xml'));
    expect(legacy.status).toBe(308);
    expect(legacy.headers.get('location')).toBe('https://concursomestre.com/sitemap.xml');
  });

  it('fails closed on preview/noncanonical hosts even with production flags', async () => {
    activateProduction();
    await createArtifacts();
    const robots = await (await getRobots(new Request('https://preview.example.com/robots.txt'))).text();
    expect(robots).not.toContain('Sitemap:');
    expect((await getSitemap(new Request('https://preview.example.com/sitemap.xml'))).status).toBe(503);
  });

  it('keeps the public RSS feed outside search indexing', () => {
    const source = readFileSync(path.resolve(process.cwd(), 'src/app/blog/feed.xml/route.ts'), 'utf8');
    expect(source).toContain("'X-Robots-Tag': 'noindex, follow'");
  });
});
