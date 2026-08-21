import { describe, expect, it } from 'vitest';
import { parsePublicSimulationDetail, parsePublicSimulationDirectory } from './simulationServerData';

const base = {
  id: 1, slug: 'simulado-publico', title: 'Simulado Público', description: null,
  durationMinutes: 60, questionCount: 1, availabilityStatus: 'available',
  path: '/simulados/simulado-publico', updatedAt: '2026-08-19T12:00:00Z',
};

describe('public simulation server contract', () => {
  it('accepts only canonical summaries', () => {
    const result = parsePublicSimulationDirectory({ items: [base, { ...base, path: '/simulation' }], pageInfo: { page: 1, pages: 1, limit: 24, total: 1 } });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].path).toBe('/simulados/simulado-publico');
  });

  it('keeps only allowlisted public relationships', () => {
    const result = parsePublicSimulationDetail({
      ...base, canonicalPath: base.path, instructions: 'Leia as orientações.', isAttemptAvailable: true,
      practicePath: '/simulation', readiness: { status: 'READY', reasonCodes: [] },
      questions: [{ id: 10, excerpt: 'Questão pública', position: 1, path: '/questoes/10/questao-publica', correctAnswer: 'SECRET' }],
      taxonomies: [], contests: [], exams: [], breadcrumbs: [{ label: 'Simulados', canonicalPath: '/simulados' }],
      user_id: 'PRIVATE', score: 100,
    });
    expect(result && !('redirectSlug' in result) ? result.questions[0] : null).toEqual({ id: 10, excerpt: 'Questão pública', position: 1, path: '/questoes/10/questao-publica' });
    expect(JSON.stringify(result)).not.toContain('SECRET');
    expect(JSON.stringify(result)).not.toContain('PRIVATE');
  });

  it('supports one-hop aliases and rejects malformed canonical payloads', () => {
    expect(parsePublicSimulationDetail({ redirectSlug: 'simulado-publico' })).toEqual({ redirectSlug: 'simulado-publico' });
    expect(parsePublicSimulationDetail({ ...base, canonicalPath: '/simulados/outro' })).toBeNull();
  });
});
