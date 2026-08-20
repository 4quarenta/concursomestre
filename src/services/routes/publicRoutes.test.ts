import { describe, expect, it } from 'vitest';
import {
  classifyPublicRouteParameter,
  isQuestionsIndexPath,
  matchesPublicRouteFamily,
  publicRoutes,
  sanitizePublicRouteQuery,
} from './publicRoutes';

describe('publicRoutes', () => {
  it('builds only the new canonical public route families', () => {
    expect(publicRoutes.questions.index()).toBe('/questoes');
    expect(publicRoutes.questions.detail(123, 'art-5o')).toBe('/questoes/123/art-5o');
    expect(publicRoutes.exams.index()).toBe('/provas');
    expect(publicRoutes.exams.detail('pmpb-2026-soldado')).toBe('/provas/pmpb-2026-soldado');
    expect(publicRoutes.disciplines.detail('direito-constitucional')).toBe('/disciplinas/direito-constitucional');
    expect(publicRoutes.topics.detail('controle-de-constitucionalidade')).toBe('/topicos/controle-de-constitucionalidade');
    expect(publicRoutes.subjects.detail('controle-concentrado')).toBe('/assuntos/controle-concentrado');
    expect(publicRoutes.boards.detail('cebraspe')).toBe('/bancas/cebraspe');
    expect(publicRoutes.organizations.index({ letra: 'P' })).toBe('/orgaos?letra=P');
    expect(publicRoutes.organizations.detail('policia-federal')).toBe('/orgaos/policia-federal');
    expect(publicRoutes.contests.index({ ano: 2026, status: 'registration_open' })).toBe('/concursos?ano=2026&status=registration_open');
    expect(publicRoutes.contests.detail('concurso-pf-2026')).toBe('/concursos/concurso-pf-2026');
    expect(publicRoutes.contests.open()).toBe('/concursos-abertos');
    expect(publicRoutes.careers.index({ letra: 'F' })).toBe('/carreiras?letra=F');
    expect(publicRoutes.careers.detail('carreira-fiscal')).toBe('/carreiras/carreira-fiscal');
    expect(publicRoutes.positions.index({ busca: 'auditor' })).toBe('/cargos?busca=auditor');
    expect(publicRoutes.positions.detail('auditor-fiscal')).toBe('/cargos/auditor-fiscal');
  });

  it('preserves supported state and repeated parameters without adding pagination', () => {
    const query = new URLSearchParams();
    query.append('materia', 'direito-constitucional');
    query.append('materia', 'direito-administrativo');
    query.append('onlySaved', 'true');
    query.append('questionId', '42');
    query.append('utm_source', 'newsletter');

    expect(publicRoutes.questions.index(query)).toBe(
      '/questoes?materia=direito-constitucional&materia=direito-administrativo&onlySaved=true&questionId=42&utm_source=newsletter',
    );
  });

  it('supports the existing exam directory filters and preserves persisted slugs', () => {
    expect(publicRoutes.exams.index({ ano: 2026, regiao: 'Nordeste', estado: 'PB' })).toBe(
      '/provas?ano=2026&regiao=Nordeste&estado=PB',
    );
    expect(publicRoutes.exams.detail('slug-persistido-com-mais-de-80-caracteres-sem-normalizacao-adicional-1234567890')).toBe(
      '/provas/slug-persistido-com-mais-de-80-caracteres-sem-normalizacao-adicional-1234567890',
    );
  });

  it('rejects parameters absent from the structural policy', () => {
    expect(() => publicRoutes.questions.index({ pagina: 2 })).toThrow('Parametro pagina nao permitido');
    expect(() => publicRoutes.questions.index({ secret: 'value' })).toThrow('Parametro secret nao permitido');
  });

  it('sanitizes redirects while preserving repeated functional parameters and dropping _rsc', () => {
    const query = new URLSearchParams();
    query.append('materia', 'direito constitucional');
    query.append('materia', 'direito administrativo');
    query.append('onlySaved', '1');
    query.append('utm_source', 'newsletter');
    query.append('_rsc', 'volatile');
    query.append('secret', 'discarded');

    expect(publicRoutes.questions.index(sanitizePublicRouteQuery('questions_hub', query))).toBe(
      '/questoes?materia=direito+constitucional&materia=direito+administrativo&onlySaved=1&utm_source=newsletter',
    );
  });

  it('preserves only tracking parameters on detail redirects', () => {
    const query = new URLSearchParams('utm_campaign=slug&questionId=42&_rsc=volatile');
    expect(publicRoutes.questions.detail(
      42,
      'slug-atual',
      sanitizePublicRouteQuery('question_detail', query),
    )).toBe('/questoes/42/slug-atual?utm_campaign=slug');
  });

  it('recognizes legacy and new collection paths without treating detail as practice', () => {
    expect(isQuestionsIndexPath('/practice')).toBe(true);
    expect(isQuestionsIndexPath('/questions?materia=1')).toBe(true);
    expect(isQuestionsIndexPath('/questoes')).toBe(true);
    expect(isQuestionsIndexPath('/questoes/123/exemplo')).toBe(false);
    expect(matchesPublicRouteFamily('question_detail', '/question/123/exemplo')).toBe(true);
    expect(matchesPublicRouteFamily('question_detail', '/questoes/123/exemplo', { includeLegacy: false })).toBe(true);
  });

  it('classifies canonical, tracking, internal and unknown query parameters from policy', () => {
    expect(classifyPublicRouteParameter('materia')).toBe('facet');
    expect(classifyPublicRouteParameter('pagina')).toBe('pagination');
    expect(classifyPublicRouteParameter('utm_campaign')).toBe('tracking');
    expect(classifyPublicRouteParameter('_rsc')).toBe('internal');
    expect(classifyPublicRouteParameter('unexpected')).toBe('unknown');
  });
});
