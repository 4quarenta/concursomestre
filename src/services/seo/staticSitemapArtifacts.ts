import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, readdir, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { seoIndexPolicy } from './runtimeEnvironment';

const SITEMAP_FILENAME = /^(?:sitemap|[a-z0-9]+(?:-[a-z0-9]+)*-[0-9]{5})\.xml$/;
const SHA256 = /^[a-f0-9]{64}$/;
const STATE_VERSION = 'database-driven-sitemap-state.v3';
const MANIFEST_VERSION = 'sitemap-release-manifest.v1';
const MANIFEST_FILENAME = 'sitemap-release-manifest.json';
const execFileAsync = promisify(execFile);

type ManifestFile = { name: string; sha256: string; size: number };
type ReleaseManifest = {
  version: string;
  artifactStateVersion: string;
  releaseId: string;
  logicalDatasetFingerprint: string;
  physicalSetFingerprint: string;
  files: ManifestFile[];
  indexReferences: string[];
};
type ValidatedRelease = { directory: string; status: Record<string, unknown>; manifest: ReleaseManifest };

const integrityCache = new Map<string, string>();
const MAX_CACHE_RELEASES = 8;
const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');

const getArtifactDirectory = () => {
  const configured = String(process.env.SITEMAP_OUTPUT_DIR || '').trim();
  return path.resolve((configured || 'backend/storage/sitemaps').replace(/[\\/]$/, ''));
};
const getPublicationStatePath = () => {
  const directory = getArtifactDirectory();
  return path.join(path.dirname(directory), `.${path.basename(directory)}-publication-state.json`);
};

const readCurrentEligibleDatasetFingerprint = async (): Promise<string | null> => {
  if (process.env.NODE_ENV === 'test') {
    const fixture = String(process.env.SITEMAP_TEST_CURRENT_FINGERPRINT || '').trim();
    return SHA256.test(fixture) ? fixture : null;
  }
  const phpBinary = String(process.env.SITEMAP_PHP_BINARY || 'php').trim();
  const script = path.resolve(String(process.env.SITEMAP_FINGERPRINT_SCRIPT || 'backend/scripts/seo/generate_static_sitemaps.php').trim());
  const configuredTimeout = Number.parseInt(String(process.env.SITEMAP_FINGERPRINT_TIMEOUT_MS || '120000'), 10);
  const timeout = Number.isFinite(configuredTimeout) ? Math.min(300_000, Math.max(1_000, configuredTimeout)) : 120_000;
  try {
    const { stdout } = await execFileAsync(phpBinary, [script], {
      cwd: process.cwd(), env: { ...process.env, SITEMAP_FINGERPRINT_ONLY: '1' }, timeout,
      maxBuffer: 1024 * 1024, windowsHide: true,
    });
    const payload = JSON.parse(stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).at(-1) || '{}') as Record<string, unknown>;
    return payload.status === 'fingerprint' && typeof payload.eligibleDatasetFingerprint === 'string' && SHA256.test(payload.eligibleDatasetFingerprint)
      ? payload.eligibleDatasetFingerprint : null;
  } catch { return null; }
};

const isCurrentStaticSitemapStatus = (value: unknown, state: unknown, currentFingerprint: string): boolean => {
  if (!value || typeof value !== 'object' || !state || typeof state !== 'object') return false;
  const status = value as Record<string, unknown>;
  const publicationState = state as Record<string, unknown>;
  const validation = status.validation as Record<string, unknown> | undefined;
  return status.indexPolicyVersion === seoIndexPolicy.version
    && status.artifactSet === 'canonical-sitemap-index'
    && status.canonicalBaseUrl === seoIndexPolicy.canonicalOrigin
    && status.artifactStateVersion === STATE_VERSION
    && status.logicalDatasetVersion === 'eligible-sitemap-dataset.v2'
    && status.releaseManifestVersion === MANIFEST_VERSION
    && status.releaseManifestFile === MANIFEST_FILENAME
    && typeof status.eligibleDatasetFingerprint === 'string' && SHA256.test(status.eligibleDatasetFingerprint)
    && typeof status.artifactFingerprint === 'string' && SHA256.test(status.artifactFingerprint)
    && typeof status.releaseId === 'string' && SHA256.test(status.releaseId)
    && typeof status.manifestHash === 'string' && SHA256.test(status.manifestHash)
    && publicationState.version === STATE_VERSION && publicationState.state === 'CURRENT'
    && currentFingerprint === status.eligibleDatasetFingerprint
    && publicationState.eligibleDatasetFingerprint === status.eligibleDatasetFingerprint
    && publicationState.artifactFingerprint === status.artifactFingerprint
    && publicationState.releaseId === status.releaseId
    && publicationState.manifestHash === status.manifestHash
    && validation?.valid === true;
};

const parseManifest = (value: unknown): ReleaseManifest | null => {
  if (!value || typeof value !== 'object') return null;
  const manifest = value as Partial<ReleaseManifest>;
  if (manifest.version !== MANIFEST_VERSION || manifest.artifactStateVersion !== STATE_VERSION
    || typeof manifest.releaseId !== 'string' || !SHA256.test(manifest.releaseId)
    || typeof manifest.logicalDatasetFingerprint !== 'string' || !SHA256.test(manifest.logicalDatasetFingerprint)
    || typeof manifest.physicalSetFingerprint !== 'string' || !SHA256.test(manifest.physicalSetFingerprint)
    || !Array.isArray(manifest.files) || !Array.isArray(manifest.indexReferences)) return null;
  const files = manifest.files.map((file) => ({
    name: String(file?.name || ''), sha256: String(file?.sha256 || ''), size: Number(file?.size),
  }));
  if (!files.length || files.some((file) => !SITEMAP_FILENAME.test(file.name) || !SHA256.test(file.sha256) || !Number.isSafeInteger(file.size) || file.size < 0)) return null;
  if (new Set(files.map((file) => file.name)).size !== files.length) return null;
  const sortedFiles = [...files].sort((a, b) => a.name.localeCompare(b.name));
  if (JSON.stringify(files) !== JSON.stringify(sortedFiles)) return null;
  const references = manifest.indexReferences.map(String);
  if (references.some((name) => name === 'sitemap.xml' || !SITEMAP_FILENAME.test(name))) return null;
  return { ...manifest, files, indexReferences: references } as ReleaseManifest;
};

const physicalFingerprint = (files: ManifestFile[]) => sha256(JSON.stringify([...files].sort((a, b) => a.name.localeCompare(b.name))));
const indexReferences = (xml: string): string[] => [...new Set([...xml.matchAll(/<loc>https:\/\/concursomestre\.com\/sitemaps\/([^<]+)<\/loc>/g)].map((match) => path.basename(match[1])))]
  .sort((a, b) => a.localeCompare(b));

const validatePhysicalSet = async (directory: string, manifest: ReleaseManifest, status: Record<string, unknown>): Promise<boolean> => {
  const actualNames = (await readdir(directory)).filter((name) => name.endsWith('.xml')).sort((a, b) => a.localeCompare(b));
  const expectedNames = manifest.files.map((file) => file.name);
  if (JSON.stringify(actualNames) !== JSON.stringify(expectedNames)) return false;
  if (manifest.logicalDatasetFingerprint !== status.eligibleDatasetFingerprint
    || manifest.physicalSetFingerprint !== status.artifactFingerprint
    || manifest.releaseId !== status.releaseId
    || physicalFingerprint(manifest.files) !== manifest.physicalSetFingerprint
    || sha256([MANIFEST_VERSION, manifest.logicalDatasetFingerprint, manifest.physicalSetFingerprint].join('\0')) !== manifest.releaseId) return false;

  const metadata = await Promise.all(actualNames.map(async (name) => {
    const info = await stat(path.join(directory, name));
    return [name, info.size, info.mtimeMs, info.ctimeMs, info.ino, info.mode].join(':');
  }));
  const cacheKey = `${directory}:${manifest.releaseId}:${String(status.manifestHash)}`;
  const signature = sha256(metadata.join('|'));
  if (integrityCache.get(cacheKey) !== signature) {
    for (const file of manifest.files) {
      const bytes = await readFile(path.join(directory, file.name));
      if (bytes.byteLength !== file.size || sha256(bytes) !== file.sha256) return false;
    }
    const indexXml = await readFile(path.join(directory, 'sitemap.xml'), 'utf8');
    const expectedReferences = manifest.files.filter((file) => file.name !== 'sitemap.xml').map((file) => file.name).sort((a, b) => a.localeCompare(b));
    if (JSON.stringify(indexReferences(indexXml)) !== JSON.stringify(expectedReferences)
      || JSON.stringify(manifest.indexReferences) !== JSON.stringify(expectedReferences)) return false;
    integrityCache.set(cacheKey, signature);
    while (integrityCache.size > MAX_CACHE_RELEASES) integrityCache.delete(integrityCache.keys().next().value as string);
  }
  return true;
};

const readValidatedRelease = async (): Promise<ValidatedRelease | null> => {
  try {
    const directory = await realpath(getArtifactDirectory());
    const [rawStatus, rawState, rawManifest, currentFingerprint] = await Promise.all([
      readFile(path.join(directory, 'sitemap-status.json'), 'utf8'),
      readFile(getPublicationStatePath(), 'utf8'),
      readFile(path.join(directory, MANIFEST_FILENAME), 'utf8'),
      readCurrentEligibleDatasetFingerprint(),
    ]);
    const status = JSON.parse(rawStatus) as Record<string, unknown>;
    if (currentFingerprint === null || sha256(rawManifest) !== status.manifestHash) return null;
    const state = JSON.parse(rawState) as unknown;
    const manifest = parseManifest(JSON.parse(rawManifest));
    if (!manifest || !isCurrentStaticSitemapStatus(status, state, currentFingerprint)) return null;
    return await validatePhysicalSet(directory, manifest, status) ? { directory, status, manifest } : null;
  } catch { return null; }
};

export const readStaticSitemapArtifact = async (filename: string): Promise<string | null> => {
  if (!SITEMAP_FILENAME.test(filename)) return null;
  const release = await readValidatedRelease();
  const file = release?.manifest.files.find((candidate) => candidate.name === filename);
  if (!release || !file) return null;
  try {
    const bytes = await readFile(path.join(release.directory, filename));
    return bytes.byteLength === file.size && sha256(bytes) === file.sha256 ? bytes.toString('utf8') : null;
  } catch { return null; }
};

export const readStaticSitemapStatus = async (): Promise<unknown | null> => (await readValidatedRelease())?.status ?? null;

export { isCurrentStaticSitemapStatus, readCurrentEligibleDatasetFingerprint };
