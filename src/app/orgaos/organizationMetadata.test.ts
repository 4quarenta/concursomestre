import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildOrganizationMetadata } from './organizationMetadata';
import { parsePublicOrganization } from './organizationServerData';

const organization = parsePublicOrganization({
  id: 70, slug: 'policia-federal', name: 'Polícia Federal', acronym: 'PF', description: null,
  website: null, imageUrl: null, stateCode: 'BR', sphere: 'Federal',
  canonicalPath: '/orgaos/policia-federal', questionsPath: '/questoes?orgao=Pol%C3%ADcia%20Federal',
  questionCount: 42, examCount: 3, roles: [], disciplines: [], boards: [], exams: [], questions: [],
  breadcrumbs: [
    { label: 'Início', canonicalPath: '/' },
    { label: 'Órgãos', canonicalPath: '/orgaos' },
    { label: 'Polícia Federal', canonicalPath: '/orgaos/policia-federal' },
  ], updatedAt: null,
});

afterEach(() => vi.unstubAllEnvs());

describe('organization metadata and route readiness', () => {
  it('is self-canonical and NOINDEX in PRELAUNCH', () => {
    vi.stubEnv('SEO_LAUNCH_MODE', 'PRELAUNCH');
    const metadata = buildOrganizationMetadata(organization);
    expect(metadata.alternates?.canonical).toBe('/orgaos/policia-federal');
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
    expect(metadata.openGraph).toMatchObject({ url: '/orgaos/policia-federal' });
  });

  it('is indexable in a controlled PRODUCTION simulation', () => {
    vi.stubEnv('SEO_LAUNCH_MODE', 'PRODUCTION');
    expect(buildOrganizationMetadata(organization).robots).toBeUndefined();
  });

  it('has no canonical for missing organizations and keeps a server-owned hard 404 page', () => {
    expect(buildOrganizationMetadata(null).alternates?.canonical).toBeNull();
    const page = readFileSync(resolve(process.cwd(), 'src/app/orgaos/[slug]/page.tsx'), 'utf8');
    expect(page).not.toContain("'use client'");
    expect(page).toContain('await fetchPublicOrganizationForServer(slug)');
    expect(page).toContain('notFound()');
    expect(page).toContain('data-semantic-content');
    expect(page).toContain('BreadcrumbList');
    expect(page).toContain("'@type': 'Organization'");
    expect(existsSync(resolve(process.cwd(), 'src/app/@seo/default.tsx'))).toBe(false);
  });
});
