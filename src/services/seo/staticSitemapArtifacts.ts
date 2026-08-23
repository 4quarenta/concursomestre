import { readFile } from 'node:fs/promises';
import { seoIndexPolicy } from './runtimeEnvironment';

const SITEMAP_FILENAME = /^(?:sitemap|[a-z0-9]+(?:-[a-z0-9]+)*-[0-9]{5})\.xml$/;

const getArtifactDirectory = () => {
  const configured = String(process.env.SITEMAP_OUTPUT_DIR || '').trim();
  return (configured || 'backend/storage/sitemaps').replace(/[\\/]$/, '');
};

export const readStaticSitemapArtifact = async (filename: string): Promise<string | null> => {
  if (!SITEMAP_FILENAME.test(filename)) {
    return null;
  }

  try {
    const status = await readStaticSitemapStatus();
    if (!isCurrentStaticSitemapStatus(status)) return null;
    return await readFile(
      /* turbopackIgnore: true */ `${getArtifactDirectory()}/${filename}`,
      'utf8',
    );
  } catch {
    return null;
  }
};

const isCurrentStaticSitemapStatus = (value: unknown): boolean => {
  if (!value || typeof value !== 'object') return false;
  const status = value as Record<string, unknown>;
  const validation = status.validation as Record<string, unknown> | undefined;
  return status.indexPolicyVersion === seoIndexPolicy.version
    && status.artifactSet === 'canonical-sitemap-index'
    && status.canonicalBaseUrl === seoIndexPolicy.canonicalOrigin
    && validation?.valid === true;
};

export const readStaticSitemapStatus = async (): Promise<unknown | null> => {
  try {
    const raw = await readFile(
      /* turbopackIgnore: true */ `${getArtifactDirectory()}/sitemap-status.json`,
      'utf8',
    );
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
};

export { isCurrentStaticSitemapStatus };
