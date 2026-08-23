import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const URL_LITERAL = /(['"`])\/(?:practice(?=[/?'"`])|questions(?=[/?'"`])|question\/|blog\/provas)/;
const ALLOWED = new Set([
  'src/proxy.ts',
  'src/services/seo/slug.ts',
]);

const collectFiles = (relativeDirectory: string): string[] => {
  const directory = path.join(ROOT, relativeDirectory);
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.posix.join(relativeDirectory.replaceAll('\\', '/'), entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__') return [];
      return collectFiles(relativePath);
    }
    return /\.(?:ts|tsx|php)$/.test(entry.name) && !/\.test\.[^.]+$/.test(entry.name)
      ? [relativePath]
      : [];
  });
};

describe('Phase 2 internal public links', () => {
  it('does not emit legacy public URL literals outside alias handlers', () => {
    const offenders = [
      ...collectFiles('src'),
      ...collectFiles('backend/modules'),
    ].filter((relativePath) => {
      if (ALLOWED.has(relativePath)) return false;
      return URL_LITERAL.test(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
    });

    expect(offenders).toEqual([]);
  }, 45_000);

  it('keeps the operational sitemap authority on canonical URLs after Checkpoint 2.3', () => {
    const pageMap = fs.readFileSync(path.join(ROOT, 'config/seo/seo-production-page-map.v1.json'), 'utf8');
    const staticSitemap = fs.readFileSync(path.join(ROOT, 'backend/scripts/seo/generate_static_sitemaps.php'), 'utf8');
    expect(pageMap).toContain('"familyId": "questions_hub"');
    expect(pageMap).toContain('"routePatterns": ["/questoes"]');
    expect(pageMap).toContain('"familyId": "exam_hub"');
    expect(pageMap).toContain('"routePatterns": ["/provas"]');
    expect(staticSitemap).toContain('$routes->questionDetail');
    expect(staticSitemap).toContain('$routes->examDetail');
    expect(staticSitemap).not.toContain("'/blog/provas'");
    expect(staticSitemap).not.toContain("'/question/'");
  });
});
