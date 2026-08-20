import { describe, expect, it } from 'vitest';
import { parseProfessionalDetail, parseProfessionalDirectory } from './professionalServerData';

const relations = {
  contests: [{ id: 1, slug: 'concurso-canonico', title: 'Concurso Canônico', status: 'published', year: 2026, organization: 'Órgão', path: '/concursos/concurso-canonico' }],
  organizations: [{ id: 2, slug: 'orgao-publico', name: 'Órgão Público', acronym: 'OP', path: '/orgaos/orgao-publico' }],
  exams: [{ id: 3, slug: 'prova-publica', name: 'Prova Pública', year: 2026, questionCount: 1, path: '/provas/prova-publica' }],
  questions: [{ id: 4, excerpt: 'Questão pública', path: '/questoes/4/questao-publica', correctAnswer: 'SECRET_ANSWER' }],
  boards: [{ id: 5, slug: 'banca-publica', name: 'Banca Pública', acronym: 'BP', path: '/bancas/banca-publica' }],
  readiness: { status: 'READY', reasonCodes: [] }, updatedAt: null,
};

const career = {
  kind: 'career', id: 10, slug: 'carreira-fiscal', name: 'Carreira Fiscal', description: null,
  canonicalPath: '/carreiras/carreira-fiscal', questionsPath: '/questoes?career=Carreira%20Fiscal', contestsPath: '/concursos',
  questionCount: 0, examCount: 0, careers: [],
  positions: [{ id: 20, slug: 'auditor-fiscal', name: 'Auditor Fiscal', questionCount: 0, examCount: 0, path: '/cargos/auditor-fiscal', providerId: 'SECRET_PROVIDER' }],
  breadcrumbs: [{ label: 'Início', canonicalPath: '/' }, { label: 'Carreiras', canonicalPath: '/carreiras' }, { label: 'Carreira Fiscal', canonicalPath: '/carreiras/carreira-fiscal' }],
  ...relations, adminNote: 'SECRET_ADMIN',
};

const position = {
  ...career, kind: 'position', id: 20, slug: 'auditor-fiscal', name: 'Auditor Fiscal',
  canonicalPath: '/cargos/auditor-fiscal', questionsPath: '/questoes?role=Auditor%20Fiscal', contestsPath: '/concursos?cargo=Auditor%20Fiscal',
  careers: [{ id: 10, slug: 'carreira-fiscal', name: 'Carreira Fiscal', path: '/carreiras/carreira-fiscal' }], positions: [],
  breadcrumbs: [{ label: 'Início', canonicalPath: '/' }, { label: 'Cargos', canonicalPath: '/cargos' }, { label: 'Auditor Fiscal', canonicalPath: '/cargos/auditor-fiscal' }],
};

describe('professional public contracts', () => {
  it('parses directories with persisted canonical paths', () => {
    expect(parseProfessionalDirectory({ items: [{ id: 10, slug: 'carreira-fiscal', name: 'Carreira Fiscal', description: null, questionCount: 0, examCount: 0, path: '/carreiras/carreira-fiscal' }], pageInfo: { page: 1, pages: 1, limit: 30, total: 1 } }, 'career').items).toHaveLength(1);
    expect(parseProfessionalDirectory({ items: [{ id: 10, slug: 'carreira-fiscal', name: 'Carreira Fiscal', path: '/cargos/carreira-fiscal' }], pageInfo: {} }, 'career').items).toEqual([]);
  });

  it('keeps career and position identity isolated', () => {
    expect(parseProfessionalDetail(career, 'career')?.kind).toBe('career');
    expect(parseProfessionalDetail(position, 'position')?.kind).toBe('position');
    expect(parseProfessionalDetail(career, 'position')).toBeNull();
    expect(parseProfessionalDetail(position, 'career')).toBeNull();
  });

  it('uses an allowlist and does not make volume a public-contract gate', () => {
    const parsed = parseProfessionalDetail(career, 'career');
    const serialized = JSON.stringify(parsed);
    expect(parsed && !('redirectSlug' in parsed) ? parsed.questionCount : -1).toBe(0);
    expect(serialized).not.toContain('SECRET_ANSWER');
    expect(serialized).not.toContain('SECRET_PROVIDER');
    expect(serialized).not.toContain('SECRET_ADMIN');
    expect(serialized).not.toContain('correctAnswer');
  });

  it('accepts only a one-hop typed alias target and rejects malformed slugs', () => {
    expect(parseProfessionalDetail({ redirectSlug: 'carreira-fiscal', private: 'SECRET' }, 'career')).toEqual({ redirectSlug: 'carreira-fiscal' });
    expect(parseProfessionalDetail({ redirectSlug: 'Carreira-Fiscal' }, 'career')).toBeNull();
    expect(parseProfessionalDetail({ ...career, canonicalPath: '/carreiras/outro' }, 'career')).toBeNull();
  });
});
