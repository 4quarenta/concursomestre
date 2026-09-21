import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildProfessionalMetadata, professionalDescription } from './professionalMetadata';
import { parseProfessionalDetail } from './professionalServerData';

const fixture = parseProfessionalDetail({
  kind: 'position', id: 20, slug: 'auditor-fiscal', name: 'Auditor Fiscal', description: null,
  canonicalPath: '/cargos/auditor-fiscal', questionsPath: '/questoes?role=Auditor%20Fiscal', contestsPath: '/concursos?cargo=Auditor%20Fiscal',
  questionCount: 0, examCount: 0, careers: [], positions: [], contests: [], organizations: [], exams: [], questions: [], boards: [],
  breadcrumbs: [{ label: 'Início', canonicalPath: '/' }, { label: 'Cargos', canonicalPath: '/cargos' }, { label: 'Auditor Fiscal', canonicalPath: '/cargos/auditor-fiscal' }],
  readiness: { status: 'READY', reasonCodes: [] }, updatedAt: null,
}, 'position');

const item = fixture && !('redirectSlug' in fixture) ? fixture : null;
afterEach(() => vi.unstubAllEnvs());

describe('professional metadata', () => {
  it('keeps self canonical and PRELAUNCH noindex', () => {
    vi.stubEnv('SEO_LAUNCH_MODE', 'PRELAUNCH');
    const metadata = buildProfessionalMetadata('position', item);
    expect(metadata.alternates?.canonical).toBe('/cargos/auditor-fiscal');
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
    expect(professionalDescription(item!)).toContain('quando disponíveis');
  });

  it('allows a READY fixture only in PRODUCTION', () => {
    vi.stubEnv('SEO_LAUNCH_MODE', 'PRODUCTION');
    expect(buildProfessionalMetadata('position', item).robots).toBeUndefined();
  });

  it('omits canonical for a missing entity', () => {
    expect(buildProfessionalMetadata('position', null).alternates?.canonical).toBeNull();
  });
});
