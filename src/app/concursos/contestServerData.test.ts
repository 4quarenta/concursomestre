import { describe, expect, it } from 'vitest';
import { parseContestDirectory, parsePublicContest } from './contestServerData';

const summary = { id: 1, slug: 'pf-2026', title: 'Concurso PF 2026', description: null, status: 'registration_open', isOpen: true, year: 2026, registrationStart: null, registrationEnd: null, organization: 'Polícia Federal', organizationAcronym: 'PF', board: 'Cebraspe', boardAcronym: 'CEBRASPE', path: '/concursos/pf-2026', updatedAt: '2026-08-19' };
const detail = {
  ...summary, officialUrl: 'https://example.test/contest', dates: {}, canonicalPath: '/concursos/pf-2026', questionCount: 1,
  organizations: [{ id: 2, slug: 'policia-federal', name: 'Polícia Federal', acronym: 'PF', path: '/orgaos/policia-federal', sourceExternalId: 'SECRET_IMPORTER' }],
  board: { id: 3, slug: 'cebraspe', name: 'Cebraspe', acronym: 'CEBRASPE', path: '/bancas/cebraspe' },
  positions: [{ id: 4, roleId: 5, name: 'Agente', vacancies: 10, reserveRegistry: false, salaryMin: 1000, salaryMax: 2000, educationLevel: 'Superior', weeklyHours: 40, locationLabel: null }],
  documents: [{ id: 6, type: 'notice', title: 'Edital', url: 'https://example.test/notice.pdf', publishedAt: null, storagePath: 'SECRET_PATH' }],
  exams: [{ id: 7, slug: 'prova-pf', title: 'Prova PF', year: 2026, questionCount: 1, path: '/provas/prova-pf' }],
  questions: [{ id: 8, excerpt: 'Questão pública', path: '/questoes/8/questao-publica', correctAnswer: 'SECRET_ANSWER' }],
  breadcrumbs: [{ label: 'Início', canonicalPath: '/' }, { label: 'Concursos', canonicalPath: '/concursos' }, { label: 'Concurso PF 2026', canonicalPath: '/concursos/pf-2026' }],
  adminNotes: 'SECRET_ADMIN', updatedAt: '2026-08-19',
};

describe('contest public contracts', () => {
  it('accepts canonical summaries and rejects synthetic paths', () => {
    expect(parseContestDirectory({ items: [summary], pageInfo: { page: 1, pages: 1, limit: 24, total: 1 } }).items).toHaveLength(1);
    expect(parseContestDirectory({ items: [{ ...summary, path: '/concursos/pf/agente/2026' }], pageInfo: {} }).items).toEqual([]);
    expect(parseContestDirectory({ items: [{ ...summary, slug: 'pf--2026', path: '/concursos/pf--2026' }], pageInfo: {} }).items).toEqual([]);
  });

  it('keeps a strict allowlist and persisted canonical identity', () => {
    const parsed = parsePublicContest(detail);
    expect(parsed && !('redirectSlug' in parsed) ? parsed.canonicalPath : null).toBe('/concursos/pf-2026');
    const serialized = JSON.stringify(parsed);
    expect(serialized).not.toContain('SECRET_IMPORTER');
    expect(serialized).not.toContain('SECRET_PATH');
    expect(serialized).not.toContain('SECRET_ANSWER');
    expect(serialized).not.toContain('SECRET_ADMIN');
  });

  it('accepts only a typed one-hop alias target', () => {
    expect(parsePublicContest({ redirectSlug: 'pf-2026', admin: 'SECRET' })).toEqual({ redirectSlug: 'pf-2026' });
    expect(parsePublicContest({ redirectSlug: '--invalid--' })).toBeNull();
    expect(parsePublicContest({ ...detail, canonicalPath: '/concursos/outro' })).toBeNull();
  });

  it('rejects internal and credential-bearing editorial URLs', () => {
    for (const url of ['http://localhost/notice.pdf', 'http://127.0.0.1/private', 'http://10.0.0.2/private', 'https://user:pass@example.com/private', 'https://storage.example/notice.pdf?X-Amz-Signature=SECRET']) {
      const parsed = parsePublicContest({ ...detail, officialUrl: url, documents: [{ id: 6, type: 'notice', title: 'Edital', url, publishedAt: null }] });
      expect(parsed && !('redirectSlug' in parsed) ? parsed.officialUrl : 'invalid').toBeNull();
      expect(parsed && !('redirectSlug' in parsed) ? parsed.documents : []).toEqual([]);
    }
  });
});
