import { describe, expect, it, vi } from 'vitest';
import { fetchPublicOrganizationForServerTest, parsePublicOrganization } from './organizationServerData';

const payload = {
  id: 70,
  slug: 'policia-federal',
  name: 'Polícia Federal',
  acronym: 'PF',
  description: 'Órgão público federal.',
  website: 'https://www.gov.br/pf/',
  imageUrl: null,
  stateCode: 'BR',
  sphere: 'Federal',
  canonicalPath: '/orgaos/policia-federal',
  questionsPath: '/questoes?orgao=Pol%C3%ADcia%20Federal',
  questionCount: 42,
  examCount: 3,
  roles: [{ id: 71, name: 'Agente', questionsPath: '/questoes?cargo=Agente' }],
  disciplines: [{ id: 10, slug: 'direito', name: 'Direito', questionCount: 12, path: '/disciplinas/direito' }],
  boards: [{ id: 30, slug: 'cebraspe', name: 'Cebraspe', acronym: 'CEBRASPE', examCount: 2, path: '/bancas/cebraspe' }],
  exams: [{ id: 20, slug: 'pf-2026', name: 'PF 2026', year: 2026, questionCount: 5, path: '/provas/pf-2026' }],
  questions: [{ id: 40, excerpt: 'Enunciado público', updatedAt: '2026-08-18', path: '/questoes/40/enunciado-publico', correctAnswer: 'SECRET_CORRECT_ANSWER_SENTINEL' }],
  breadcrumbs: [
    { label: 'Início', canonicalPath: '/' },
    { label: 'Órgãos', canonicalPath: '/orgaos' },
    { label: 'Polícia Federal', canonicalPath: '/orgaos/policia-federal' },
  ],
  updatedAt: '2026-08-18',
  externalImporterIdentity: 'SECRET_IMPORTER_SENTINEL',
  adminNote: 'SECRET_ADMIN_NOTE_SENTINEL',
};

describe('organizationServerData', () => {
  it('parses only the public allowlist', () => {
    const parsed = parsePublicOrganization(payload);
    const serialized = JSON.stringify(parsed);
    expect(parsed?.canonicalPath).toBe('/orgaos/policia-federal');
    expect(parsed?.roles[0].questionsPath).toBe('/questoes?cargo=Agente');
    expect(serialized).not.toContain('SECRET_CORRECT_ANSWER_SENTINEL');
    expect(serialized).not.toContain('SECRET_IMPORTER_SENTINEL');
    expect(serialized).not.toContain('SECRET_ADMIN_NOTE_SENTINEL');
    expect(serialized).not.toContain('correctAnswer');
  });

  it('loads once and preserves the persisted slug', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true, data: payload }) });
    const result = await fetchPublicOrganizationForServerTest('policia-federal', {
      fetchImpl: fetchImpl as typeof fetch,
      apiBaseUrl: 'https://example.test/api/',
    });
    expect(result?.canonicalPath).toBe('/orgaos/policia-federal');
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(String(fetchImpl.mock.calls[0][0])).toContain('filters/organization.php?slug=policia-federal');
  });

  it('returns null for 404 and rejects invalid contracts', async () => {
    const missingFetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    await expect(fetchPublicOrganizationForServerTest('inexistente', {
      fetchImpl: missingFetch as typeof fetch,
      apiBaseUrl: 'https://example.test/api/',
    })).resolves.toBeNull();
    expect(parsePublicOrganization({ ...payload, canonicalPath: '/orgaos/outro' })).toBeNull();
    expect(parsePublicOrganization({ ...payload, boards: [{ ...payload.boards[0], path: '/admin' }] })?.boards).toEqual([]);
  });
});
