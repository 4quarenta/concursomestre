import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(
  path.resolve(process.cwd(), 'src/app/admin/components/marketing/AdminFeaturedOrganizationsManager.tsx'),
  'utf8',
);

describe('admin featured organizations manager', () => {
  it('searches the canonical directory and exposes direct selection actions', () => {
    expect(source).toContain("filtersService.listAdminPage({ page: organizationPage, perPage: 20, type: 'orgao', search: normalizeOrganizationSearch(organizationSearch) })");
    expect(source).toContain('Resultados do diretório canônico de órgãos');
    expect(source).toContain("onClick={() => selectOrganization(organization)}");
    expect(source).toContain('ID canônico #');
    expect(source).toContain('organization.slug');
  });

  it('hydrates saved canonical IDs when the current search page changes', () => {
    expect(source).toContain('filtersService.getAdminItem(id)');
    expect(source).toContain('const knownOrganizations = useMemo');
    expect(source).toContain('knownOrganizations.map((organization)');
  });
});
