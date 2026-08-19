import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('practice taxonomy route wiring', () => {
  it.each([
    ['src/app/disciplinas/[slug]/page.tsx', "fetchPublicDisciplineForServer", "permanentRedirect(discipline.canonicalPath)"],
    ['src/app/topicos/[slug]/page.tsx', "fetchPublicKnowledgeTaxonomyForServer('topico', slug)", "permanentRedirect(topic.canonicalPath)"],
    ['src/app/assuntos/[slug]/page.tsx', "fetchPublicKnowledgeTaxonomyForServer('assunto', slug)", "permanentRedirect(subject.canonicalPath)"],
  ])('%s uses a server loader, hard 404 and typed permanent alias redirect', (path, fetchCall, redirectCall) => {
    const source = read(path);
    expect(source).toContain(fetchCall);
    expect(source).toContain('notFound()');
    expect(source).toContain(redirectCall);
    expect(source).not.toContain("'use client'");
    expect(source).not.toMatch(/useDocumentSeo|document\.title/);
  });

  it('does not create a public subtopic landing', () => {
    expect(() => read('src/app/subtopicos/[slug]/page.tsx')).toThrow();
  });

  it('links question taxonomies only from persisted, explicitly typed slugs', () => {
    const source = read('src/app/question/QuestionPublicPage.tsx');
    expect(source).toContain('publicRoutes.disciplines.detail(slug)');
    expect(source).toContain('publicRoutes.topics.detail(slug)');
    expect(source).toContain('publicRoutes.subjects.detail(slug)');
    expect(source).toContain("level === 'assunto'");
    expect(source).toContain('record.seoReady !== true');
    expect(source).not.toContain('slugify(');
  });
});
