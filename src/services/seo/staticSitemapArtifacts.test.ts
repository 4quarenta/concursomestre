import { mkdtemp, rm, writeFile, unlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readStaticSitemapArtifact, readStaticSitemapStatus } from './staticSitemapArtifacts';

const originalOutputDirectory = process.env.SITEMAP_OUTPUT_DIR;
const originalCurrentRevisionToken = process.env.SITEMAP_TEST_CURRENT_REVISION_TOKEN;
const directories: string[] = [];
const stateFiles: string[] = [];
const hash = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');
const releaseId = (logical: string, physical: string) => hash(['sitemap-release-manifest.v1', logical, physical].join('\0'));

const indexFor = (...names: string[]) => `<sitemapindex>${names.map((name) => `<sitemap><loc>https://concursomestre.com/sitemaps/${name}</loc></sitemap>`).join('')}</sitemapindex>`;

const writeCurrentState = async (directory: string, files: Record<string, string>) => {
  const manifestFiles = Object.entries(files).map(([name, body]) => ({ name, sha256: hash(body), size: Buffer.byteLength(body) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const datasetFingerprint = hash('eligible-db-rows');
  const datasetRevisionToken = hash('dataset-revision:1');
  const artifactFingerprint = hash(JSON.stringify(manifestFiles));
  const id = releaseId(datasetFingerprint, artifactFingerprint);
  const references = manifestFiles.filter((file) => file.name !== 'sitemap.xml').map((file) => file.name);
  const manifest = JSON.stringify({
    version: 'sitemap-release-manifest.v1', artifactStateVersion: 'database-driven-sitemap-state.v4', releaseId: id,
    logicalDatasetFingerprint: datasetFingerprint, physicalSetFingerprint: artifactFingerprint,
    files: manifestFiles, indexReferences: references,
  });
  const manifestHash = hash(manifest);
  process.env.SITEMAP_TEST_CURRENT_REVISION_TOKEN = datasetRevisionToken;
  await writeFile(path.join(directory, 'sitemap-release-manifest.json'), manifest, 'utf8');
  await writeFile(path.join(directory, 'sitemap-status.json'), JSON.stringify({
    artifactSet: 'canonical-sitemap-index', indexPolicyVersion: 'index-policy-phase-6.v1', canonicalBaseUrl: 'https://concursomestre.com',
    artifactStateVersion: 'database-driven-sitemap-state.v4', logicalDatasetVersion: 'eligible-sitemap-dataset.v2',
    datasetRevisionVersion: 'sitemap-dataset-revision.v1', datasetRevisionToken,
    releaseManifestVersion: 'sitemap-release-manifest.v1', releaseManifestFile: 'sitemap-release-manifest.json',
    eligibleDatasetFingerprint: datasetFingerprint, artifactFingerprint, releaseId: id, manifestHash,
    validation: { valid: true },
  }), 'utf8');
  const statePath = path.join(path.dirname(directory), `.${path.basename(directory)}-publication-state.json`);
  if (!stateFiles.includes(statePath)) stateFiles.push(statePath);
  await writeFile(statePath, JSON.stringify({
    version: 'database-driven-sitemap-state.v4', state: 'CURRENT', eligibleDatasetFingerprint: datasetFingerprint,
    datasetRevisionToken,
    artifactFingerprint, releaseId: id, manifestHash,
  }), 'utf8');
};

const fixture = async (prefix: string) => {
  const directory = await mkdtemp(path.join(tmpdir(), prefix));
  directories.push(directory); process.env.SITEMAP_OUTPUT_DIR = directory;
  const files = {
    'questions-00001.xml': '<urlset><url><loc>https://concursomestre.com/questoes/1/a</loc></url></urlset>',
    'exams-00001.xml': '<urlset><url><loc>https://concursomestre.com/provas/a</loc></url></urlset>',
    'sitemap.xml': indexFor('questions-00001.xml', 'exams-00001.xml'),
  };
  await Promise.all(Object.entries(files).map(([name, body]) => writeFile(path.join(directory, name), body, 'utf8')));
  await writeCurrentState(directory, files);
  return { directory, files };
};

afterEach(async () => {
  if (originalOutputDirectory === undefined) delete process.env.SITEMAP_OUTPUT_DIR;
  else process.env.SITEMAP_OUTPUT_DIR = originalOutputDirectory;
  if (originalCurrentRevisionToken === undefined) delete process.env.SITEMAP_TEST_CURRENT_REVISION_TOKEN;
  else process.env.SITEMAP_TEST_CURRENT_REVISION_TOKEN = originalCurrentRevisionToken;
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
  await Promise.all(stateFiles.splice(0).map((statePath) => rm(statePath, { force: true })));
});

describe('static sitemap release integrity', () => {
  it('serves only members of a complete current release', async () => {
    const { files } = await fixture('cm-sitemap-');
    await expect(readStaticSitemapArtifact('sitemap.xml')).resolves.toBe(files['sitemap.xml']);
    await expect(readStaticSitemapArtifact('questions-00001.xml')).resolves.toBe(files['questions-00001.xml']);
    await expect(readStaticSitemapArtifact('../settings.php')).resolves.toBeNull();
    await expect(readStaticSitemapArtifact('missing.xml')).resolves.toBeNull();
    await expect(readStaticSitemapStatus()).resolves.toMatchObject({ artifactSet: 'canonical-sitemap-index' });
  });

  it('denies the entire release after requested-file or cross-shard corruption', async () => {
    const first = await fixture('cm-sitemap-corrupt-shard-');
    await expect(readStaticSitemapArtifact('sitemap.xml')).resolves.toBe(first.files['sitemap.xml']);
    await writeFile(path.join(first.directory, 'questions-00001.xml'), '<corrupt/>', 'utf8');
    await expect(readStaticSitemapArtifact('sitemap.xml')).resolves.toBeNull();

    const second = await fixture('cm-sitemap-corrupt-index-');
    await expect(readStaticSitemapArtifact('exams-00001.xml')).resolves.toBe(second.files['exams-00001.xml']);
    await writeFile(path.join(second.directory, 'sitemap.xml'), '<corrupt/>', 'utf8');
    await expect(readStaticSitemapArtifact('exams-00001.xml')).resolves.toBeNull();
  });

  it('fails closed for missing and extra XML members', async () => {
    const missing = await fixture('cm-sitemap-missing-');
    await unlink(path.join(missing.directory, 'exams-00001.xml'));
    await expect(readStaticSitemapArtifact('sitemap.xml')).resolves.toBeNull();

    const extra = await fixture('cm-sitemap-extra-');
    await writeFile(path.join(extra.directory, 'extra-00001.xml'), '<urlset/>', 'utf8');
    await expect(readStaticSitemapArtifact('questions-00001.xml')).resolves.toBeNull();
  });

  it('fails closed for manifest, state, and aggregate fingerprint corruption', async () => {
    const manifest = await fixture('cm-sitemap-manifest-');
    await writeFile(path.join(manifest.directory, 'sitemap-release-manifest.json'), '{}', 'utf8');
    await expect(readStaticSitemapArtifact('sitemap.xml')).resolves.toBeNull();

    const state = await fixture('cm-sitemap-state-');
    await writeFile(path.join(path.dirname(state.directory), `.${path.basename(state.directory)}-publication-state.json`), '{}', 'utf8');
    await expect(readStaticSitemapArtifact('sitemap.xml')).resolves.toBeNull();

    const aggregate = await fixture('cm-sitemap-aggregate-');
    const statusPath = path.join(aggregate.directory, 'sitemap-status.json');
    const status = JSON.parse(await (await import('node:fs/promises')).readFile(statusPath, 'utf8'));
    status.artifactFingerprint = hash('wrong-aggregate');
    await writeFile(statusPath, JSON.stringify(status), 'utf8');
    await expect(readStaticSitemapArtifact('sitemap.xml')).resolves.toBeNull();
  });

  it('denies DIRTY state and direct database fingerprint drift', async () => {
    const dirty = await fixture('cm-sitemap-dirty-');
    await writeFile(path.join(path.dirname(dirty.directory), `.${path.basename(dirty.directory)}-publication-state.json`), JSON.stringify({
      version: 'database-driven-sitemap-state.v4', state: 'DIRTY',
    }), 'utf8');
    await expect(readStaticSitemapArtifact('sitemap.xml')).resolves.toBeNull();

    await fixture('cm-sitemap-drift-');
    process.env.SITEMAP_TEST_CURRENT_REVISION_TOKEN = hash('direct-sql-drift');
    await expect(readStaticSitemapArtifact('sitemap.xml')).resolves.toBeNull();
  });
});
