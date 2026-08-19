import { describe, expect, it, vi } from 'vitest';
import { buildKnowledgeTaxonomyMetadata, knowledgeTaxonomyDescription, knowledgeTaxonomyTitle } from './knowledgeTaxonomyMetadata';
import { fetchPublicKnowledgeTaxonomyForServerTest, parsePublicKnowledgeTaxonomy } from './knowledgeTaxonomyServerData';

const base = {
  id: 12,
  slug: 'controle-de-constitucionalidade',
  requestedSlug: 'controle-de-constitucionalidade',
  name: 'Controle de Constitucionalidade',
  description: null,
  taxonomyLevel: 'topico',
  canonicalPath: '/topicos/controle-de-constitucionalidade',
  questionsPath: '/questoes?topico=Controle%20de%20Constitucionalidade',
  readiness: { status: 'READY', reasonCodes: [] },
  parent: { id: 10, slug: 'direito-constitucional', name: 'Direito Constitucional', taxonomyLevel: 'materia', path: '/disciplinas/direito-constitucional' },
  root: { id: 10, slug: 'direito-constitucional', name: 'Direito Constitucional', taxonomyLevel: 'materia', path: '/disciplinas/direito-constitucional' },
  topic: { id: 12, slug: 'controle-de-constitucionalidade', name: 'Controle de Constitucionalidade', taxonomyLevel: 'topico', path: '/topicos/controle-de-constitucionalidade' },
  subtopic: null,
  questionCount: 3,
  topics: [],
  subtopics: [{ id: 13, slug: 'controle-concentrado', name: 'Controle Concentrado', taxonomyLevel: 'subtopico' }],
  subjects: [{ id: 14, slug: 'acao-direta', name: 'Ação Direta', taxonomyLevel: 'assunto', questionCount: 2, path: '/assuntos/acao-direta', questionsPath: '/questoes?assunto=A%C3%A7%C3%A3o%20Direta', subtopicId: 13, subtopicName: 'Controle Concentrado' }],
  exams: [], boards: [], organizations: [],
  questions: [{ id: 40, excerpt: 'Enunciado público', updatedAt: null, path: '/questoes/40/enunciado-publico', correctAnswer: 'SECRET_ANSWER' }],
  breadcrumbs: [
    { label: 'Início', canonicalPath: '/' },
    { label: 'Disciplinas', canonicalPath: '/disciplinas' },
    { label: 'Direito Constitucional', canonicalPath: '/disciplinas/direito-constitucional' },
    { label: 'Controle de Constitucionalidade', canonicalPath: '/topicos/controle-de-constitucionalidade' },
  ],
  updatedAt: null,
  externalImporterIdentity: 'SECRET_IMPORTER',
};

describe('knowledge taxonomy public contract', () => {
  it('parses a topic hierarchy and drops protected extras', () => {
    const parsed = parsePublicKnowledgeTaxonomy(base, 'topico');
    expect(parsed?.root?.slug).toBe('direito-constitucional');
    expect(parsed?.subjects[0].path).toBe('/assuntos/acao-direta');
    expect(JSON.stringify(parsed)).not.toContain('SECRET_ANSWER');
    expect(JSON.stringify(parsed)).not.toContain('SECRET_IMPORTER');
  });

  it('isolates route levels and invalid contracts', () => {
    expect(parsePublicKnowledgeTaxonomy(base, 'assunto')).toBeNull();
    expect(parsePublicKnowledgeTaxonomy({ ...base, canonicalPath: '/disciplinas/controle-de-constitucionalidade' }, 'topico')).toBeNull();
  });

  it('keeps an invalid chain renderable but noindex in PRODUCTION', () => {
    const taxonomy = parsePublicKnowledgeTaxonomy({
      ...base,
      readiness: { status: 'NOT_READY', reasonCodes: ['instance_readiness.invalid_taxonomy_chain'] },
    }, 'topico');
    const previous = process.env.SEO_LAUNCH_MODE;
    process.env.SEO_LAUNCH_MODE = 'PRODUCTION';
    try {
      expect(buildKnowledgeTaxonomyMetadata(taxonomy).robots).toMatchObject({ index: false, follow: true });
      expect(buildKnowledgeTaxonomyMetadata(taxonomy).alternates?.canonical).toBe(base.canonicalPath);
    } finally {
      if (previous === undefined) delete process.env.SEO_LAUNCH_MODE;
      else process.env.SEO_LAUNCH_MODE = previous;
    }
  });

  it('indexes READY topic and subject fixtures only in PRODUCTION and disambiguates titles with root context', () => {
    const topic = parsePublicKnowledgeTaxonomy(base, 'topico');
    const sameNameOtherRoot = parsePublicKnowledgeTaxonomy({
      ...base,
      root: { id: 99, slug: 'direito-administrativo', name: 'Direito Administrativo', taxonomyLevel: 'materia', path: '/disciplinas/direito-administrativo' },
    }, 'topico');
    expect(knowledgeTaxonomyTitle(topic!)).not.toBe(knowledgeTaxonomyTitle(sameNameOtherRoot!));

    const subject = parsePublicKnowledgeTaxonomy({ ...base,
      taxonomyLevel: 'assunto', slug: 'acao-direta', requestedSlug: 'acao-direta', name: 'Ação Direta',
      canonicalPath: '/assuntos/acao-direta', questionsPath: '/questoes?assunto=A%C3%A7%C3%A3o%20Direta',
      parent: base.subtopics[0], subtopic: base.subtopics[0], breadcrumbs: [...base.breadcrumbs.slice(0, -1), { label: 'Ação Direta', canonicalPath: '/assuntos/acao-direta' }],
    }, 'assunto');
    expect(knowledgeTaxonomyTitle(subject!)).toContain('Ação Direta — Controle Concentrado — Controle de Constitucionalidade — Direito Constitucional');
    expect(knowledgeTaxonomyDescription({ ...subject!, questionCount: 0 })).not.toContain('questões públicas relacionadas');
    expect(knowledgeTaxonomyDescription(subject!)).toContain('3 questões públicas relacionadas');

    const previous = process.env.SEO_LAUNCH_MODE;
    process.env.SEO_LAUNCH_MODE = 'PRODUCTION';
    try {
      expect(buildKnowledgeTaxonomyMetadata(topic).robots).toBeUndefined();
      expect(buildKnowledgeTaxonomyMetadata(topic).alternates?.canonical).toBe(base.canonicalPath);
    } finally {
      if (previous === undefined) delete process.env.SEO_LAUNCH_MODE;
      else process.env.SEO_LAUNCH_MODE = previous;
    }
  });

  it('shares one cold fetch and preserves typed endpoint parameters', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true, data: base }) });
    await expect(fetchPublicKnowledgeTaxonomyForServerTest('topico', base.slug, { fetchImpl: fetchImpl as typeof fetch, apiBaseUrl: 'https://example.test/api/' })).resolves.toMatchObject({ slug: base.slug });
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(String(fetchImpl.mock.calls[0][0])).toContain('level=topico&slug=controle-de-constitucionalidade');
  });
});
