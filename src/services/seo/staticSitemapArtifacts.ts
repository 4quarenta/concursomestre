import { readFile } from 'node:fs/promises';

const SITEMAP_FILENAME = /^(?:sitemap|blog-sitemap|google-news|[a-z0-9]+(?:-[a-z0-9]+)*-[0-9]{5})\.xml$/;

const getArtifactDirectory = () => {
  const configured = String(process.env.SITEMAP_OUTPUT_DIR || '').trim();
  return (configured || 'backend/storage/sitemaps').replace(/[\\/]$/, '');
};

export const readStaticSitemapArtifact = async (filename: string): Promise<string | null> => {
  if (!SITEMAP_FILENAME.test(filename)) {
    return null;
  }

  try {
    return await readFile(
      /* turbopackIgnore: true */ `${getArtifactDirectory()}/${filename}`,
      'utf8',
    );
  } catch {
    return null;
  }
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
