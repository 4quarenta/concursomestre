import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildDisciplineMetadata } from './disciplineMetadata';
import { parsePublicDiscipline } from './disciplineServerData';

const discipline = parsePublicDiscipline({
  id: 1,
  slug: 'direito',
  name: 'Direito',
  requestedSlug: 'direito',
  description: null,
  taxonomyLevel: 'materia',
  canonicalPath: '/disciplinas/direito',
  questionsPath: '/questoes?materia=Direito',
  readiness: { status: 'READY', reasonCodes: [] },
  parent: null, root: null, topic: null, subtopic: null,
  questionCount: 20,
  topics: [], subtopics: [], subjects: [], exams: [], boards: [], organizations: [], questions: [],
  breadcrumbs: [
    { label: 'Início', canonicalPath: '/' },
    { label: 'Disciplinas', canonicalPath: '/disciplinas' },
    { label: 'Direito', canonicalPath: '/disciplinas/direito' },
  ],
  updatedAt: null,
});

describe('discipline detail metadata and readiness', () => {
  it('is PRELAUNCH NOINDEX with a self canonical for valid disciplines', () => {
    const metadata = buildDisciplineMetadata(discipline);
    expect(metadata.alternates?.canonical).toBe('/disciplinas/direito');
    expect(metadata.robots).toMatchObject({ index: false, follow: true });
    expect(metadata.openGraph).toMatchObject({ url: '/disciplinas/direito' });
  });

  it('becomes INDEX in PRODUCTION when structural readiness passes', () => {
    const previous = process.env.SEO_LAUNCH_MODE;
    process.env.SEO_LAUNCH_MODE = 'PRODUCTION';
    try {
      expect(buildDisciplineMetadata(discipline).robots).toBeUndefined();
    } finally {
      if (previous === undefined) delete process.env.SEO_LAUNCH_MODE;
      else process.env.SEO_LAUNCH_MODE = previous;
    }
  });

  it('has no canonical and is noindex for missing disciplines', () => {
    const metadata = buildDisciplineMetadata(null);
    expect(metadata.alternates?.canonical).toBeNull();
    expect(metadata.robots).toMatchObject({ index: false });
  });

  it('keeps the page server-owned, semantic, hard-404 capable and outside @seo', () => {
    const page = readFileSync(resolve(process.cwd(), 'src/app/disciplinas/[slug]/page.tsx'), 'utf8');
    expect(page).not.toContain("'use client'");
    expect(page).toContain('await fetchPublicDisciplineForServer(slug)');
    expect(page).toContain('notFound()');
    expect(page).toContain('KnowledgeTaxonomyDetail');
    expect(existsSync(resolve(process.cwd(), 'src/app/@seo/default.tsx'))).toBe(false);
  });
});
