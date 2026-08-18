import { describe, expect, it, vi } from 'vitest';
import { fetchPublicDisciplineForServerTest, parsePublicDiscipline } from './disciplineServerData';

const payload = {
  id: 10,
  slug: 'direito-constitucional',
  name: 'Direito Constitucional',
  description: 'Descrição pública.',
  canonicalPath: '/disciplinas/direito-constitucional',
  questionsPath: '/questoes?materia=Direito%20Constitucional',
  parent: null,
  root: null,
  questionCount: 12,
  topics: [{ id: 11, slug: 'controle', name: 'Controle', questionCount: 5, questionsPath: '/questoes?topico=Controle' }],
  exams: [{ id: 20, slug: 'prova', name: 'Prova', year: 2026, questionCount: 3, path: '/provas/prova' }],
  boards: [{ id: 30, slug: 'cebraspe', name: 'Cebraspe', acronym: 'CEBRASPE', questionCount: 8, path: '/bancas/cebraspe' }],
  questions: [{ id: 40, excerpt: 'Enunciado público', updatedAt: '2026-08-16', path: '/questoes/40/enunciado-publico', correctAnswer: 'SECRET_CORRECT_ANSWER_SENTINEL' }],
  breadcrumbs: [
    { label: 'Início', canonicalPath: '/' },
    { label: 'Disciplinas', canonicalPath: '/disciplinas' },
    { label: 'Direito Constitucional', canonicalPath: '/disciplinas/direito-constitucional' },
  ],
  updatedAt: '2026-08-16',
  externalImporterIdentity: 'SECRET_IMPORTER_SENTINEL',
  adminNote: 'SECRET_ADMIN_NOTE_SENTINEL',
};

describe('disciplineServerData', () => {
  it('consumes the public allowlist and drops protected or administrative extras', () => {
    const parsed = parsePublicDiscipline(payload);
    const serialized = JSON.stringify(parsed);
    expect(parsed?.questions[0].excerpt).toBe('Enunciado público');
    expect(serialized).not.toContain('SECRET_CORRECT_ANSWER_SENTINEL');
    expect(serialized).not.toContain('SECRET_IMPORTER_SENTINEL');
    expect(serialized).not.toContain('SECRET_ADMIN_NOTE_SENTINEL');
    expect(serialized).not.toContain('correctAnswer');
  });

  it('loads the endpoint once and preserves the persisted canonical slug', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: payload }),
    });
    const result = await fetchPublicDisciplineForServerTest('direito-constitucional', {
      fetchImpl: fetchImpl as typeof fetch,
      apiBaseUrl: 'https://example.test/api/',
    });
    expect(result?.canonicalPath).toBe('/disciplinas/direito-constitucional');
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(String(fetchImpl.mock.calls[0][0])).toContain('filters/discipline.php?slug=direito-constitucional');
  });

  it('returns null only for an explicit backend 404', async () => {
    const missingFetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    await expect(fetchPublicDisciplineForServerTest('inexistente', {
      fetchImpl: missingFetch as typeof fetch,
      apiBaseUrl: 'https://example.test/api/',
    })).resolves.toBeNull();

    const failedFetch = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    await expect(fetchPublicDisciplineForServerTest('falha', {
      fetchImpl: failedFetch as typeof fetch,
      apiBaseUrl: 'https://example.test/api/',
    })).rejects.toThrow('public_discipline_fetch_failed:503');
  });

  it('rejects a canonical mismatch instead of silently trusting an invalid contract', () => {
    expect(parsePublicDiscipline({ ...payload, canonicalPath: '/disciplinas/outra' })).toBeNull();
    expect(parsePublicDiscipline({ ...payload, boards: [{ ...payload.boards[0], path: '/admin' }] })?.boards).toEqual([]);
    expect(parsePublicDiscipline({ ...payload, questions: [{ ...payload.questions[0], path: '/question/40/alias' }] })?.questions).toEqual([]);
  });
});
