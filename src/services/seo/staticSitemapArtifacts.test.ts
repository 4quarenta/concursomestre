import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readStaticSitemapArtifact, readStaticSitemapStatus } from './staticSitemapArtifacts';

const originalOutputDirectory = process.env.SITEMAP_OUTPUT_DIR;
const directories: string[] = [];

afterEach(async () => {
  if (originalOutputDirectory === undefined) {
    delete process.env.SITEMAP_OUTPUT_DIR;
  } else {
    process.env.SITEMAP_OUTPUT_DIR = originalOutputDirectory;
  }
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('static sitemap artifacts', () => {
  it('reads only materialized sitemap files from the configured directory', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'cm-sitemap-'));
    directories.push(directory);
    process.env.SITEMAP_OUTPUT_DIR = directory;
    await writeFile(path.join(directory, 'sitemap.xml'), '<sitemapindex/>', 'utf8');
    await writeFile(path.join(directory, 'questions-00001.xml'), '<urlset/>', 'utf8');
    await writeFile(path.join(directory, 'sitemap-status.json'), JSON.stringify({
      artifactSet: 'canonical-sitemap-index',
      indexPolicyVersion: 'index-policy-phase-6.v1',
      canonicalBaseUrl: 'https://concursomestre.com',
      validation: { valid: true },
    }), 'utf8');

    await expect(readStaticSitemapArtifact('sitemap.xml')).resolves.toBe('<sitemapindex/>');
    await expect(readStaticSitemapArtifact('questions-00001.xml')).resolves.toBe('<urlset/>');
    await expect(readStaticSitemapArtifact('../settings.php')).resolves.toBeNull();
    await expect(readStaticSitemapArtifact('missing.xml')).resolves.toBeNull();
  });

  it('rejects a stale or unvalidated artifact tree', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'cm-sitemap-stale-'));
    directories.push(directory);
    process.env.SITEMAP_OUTPUT_DIR = directory;
    await writeFile(path.join(directory, 'sitemap.xml'), '<sitemapindex/>', 'utf8');
    await writeFile(path.join(directory, 'sitemap-status.json'), JSON.stringify({
      indexPolicyVersion: 'phase-5',
      validation: { valid: true },
    }), 'utf8');

    await expect(readStaticSitemapArtifact('sitemap.xml')).resolves.toBeNull();
  });

  it('returns the persisted status instead of rebuilding sitemap data', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'cm-sitemap-status-'));
    directories.push(directory);
    process.env.SITEMAP_OUTPUT_DIR = directory;
    await writeFile(path.join(directory, 'sitemap-status.json'), JSON.stringify({ totalUrls: 42 }), 'utf8');

    await expect(readStaticSitemapStatus()).resolves.toEqual({ totalUrls: 42 });
  });
});
