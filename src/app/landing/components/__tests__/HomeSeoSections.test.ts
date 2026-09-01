import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const homeSource = fs.readFileSync(path.resolve(process.cwd(), 'src/app/page.tsx'), 'utf8');
const sectionsSource = fs.readFileSync(path.resolve(process.cwd(), 'src/app/landing/components/HomeSeoSections.tsx'), 'utf8');
const dataSource = fs.readFileSync(path.resolve(process.cwd(), 'src/app/landing/homeSeoServerData.ts'), 'utf8');
const landingSource = fs.readFileSync(path.resolve(process.cwd(), 'src/app/landing/components/LandingCommercialPage.tsx'), 'utf8');

describe('home SEO SSR sections', () => {
  it('loads both public collections on the server and renders canonical links', () => {
    expect(homeSource).toContain('fetchHomeSeoDataForServer');
    expect(homeSource).toContain('latestArticles={homeSeo.latestArticles}');
    expect(homeSource).toContain('featuredOrganizations={homeSeo.featuredOrganizations}');
    expect(homeSource).toContain('structuredLists');
    expect(sectionsSource).toContain('href={`/blog/${article.slug}`}');
    expect(sectionsSource).toContain('publicRoutes.organizations.detail(organization.slug)');
    expect(sectionsSource).toContain('Ver todas as notícias');
    expect(sectionsSource).toContain('Ver todos os órgãos');
    expect(dataSource).toContain("published_only: '1'");
    expect(dataSource).toContain('safeHomeImageUrl');
    expect(dataSource).toContain('filterId');
    expect(homeSource).toContain('publicRoutes.organizations.detail(organization.slug)');
    expect(sectionsSource).toContain('organization.imageUrl');
    expect(fs.readFileSync(path.resolve(process.cwd(), 'src/components/shared/layout/Footer.tsx'), 'utf8')).toContain('identificação e referência');
  });

  it('keeps organization logos local and provenance-backed', () => {
    const logosSource = fs.readFileSync(path.resolve(process.cwd(), 'src/app/landing/officialOrganizationLogos.ts'), 'utf8');
    expect(logosSource).toContain("sourceType: 'OFFICIAL'");
    expect(logosSource).toContain("usageContext: 'ORGANIZATION_IDENTIFICATION'");
    expect(logosSource).not.toContain('http://');
    expect(logosSource).toContain("status: 'READY'");
    expect((logosSource.match(/organization: '/g) || []).length).toBe(8);
  });

  it('uses stable media dimensions and no client fetch authority', () => {
    expect(sectionsSource).toContain('width={960}');
    expect(sectionsSource).toContain('height={540}');
    expect(sectionsSource).toContain("timeZone: 'UTC'");
    expect(sectionsSource).not.toContain('fetch(');
    expect(homeSource).not.toContain('useDocumentSeo');
  });

  it('keeps every retained resource card on an existing canonical route', () => {
    for (const route of ['/provas', '/cronograma', '/x-ray', '/simulados', '/questoes', '/performance/subjects', '/lei-comentada']) {
      expect(sectionsSource + homeSource + landingSource).toContain(`'${route}'`);
    }
  });
});
