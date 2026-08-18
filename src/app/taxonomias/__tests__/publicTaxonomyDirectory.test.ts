import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const readSource = (relativePath: string) => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
const directorySource = readSource('src/app/taxonomias/PublicTaxonomyDirectory.tsx');
const serverDataSource = readSource('src/app/taxonomias/taxonomyDirectoryServerData.ts');
const frameSource = readSource('src/providers/NextRouteFrame.tsx');
const landingSource = readSource('src/app/landing/components/LandingCommercialPage.tsx');
const footerSource = readSource('src/components/shared/layout/Footer.tsx');
const hierarchySource = readSource('src/app/taxonomias/PublicSubjectTaxonomyAccordion.tsx');

describe('public taxonomy directories', () => {
  it('renders disciplines and boards on the server with search, alphabet and pagination', () => {
    expect(readSource('src/app/disciplinas/page.tsx')).toContain('type="subjects"');
    expect(readSource('src/app/bancas/page.tsx')).toContain('type="boards"');
    expect(directorySource).toContain('LETTERS.map');
    expect(directorySource).toContain('name="busca"');
    expect(directorySource).toContain('directory.pageInfo.hasMore');
    expect(serverDataSource).toContain("next: { revalidate: 300 }");
    expect(serverDataSource).toContain("filters/directory.php");
    expect(serverDataSource).toContain('examCount');
    expect(serverDataSource).toContain("include_counts', 'questions,exams'");
    expect(directorySource).toContain('item.examCount');
  });

  it('expands topics and subjects only when the user opens a taxonomy branch', () => {
    expect(directorySource).toContain('PublicSubjectTaxonomyAccordion');
    expect(hierarchySource).toContain('filters/directory.php?view=hierarchy');
    expect(hierarchySource).toContain('aria-expanded');
    expect(hierarchySource).toContain('Carregar mais');
    expect(serverDataSource).not.toContain('view=hierarchy');
  });

  it('separates the discipline landing from the functional question facet', () => {
    expect(directorySource).toContain('publicRoutes.disciplines.detail(item.slug)');
    expect(hierarchySource).toContain('publicRoutes.disciplines.detail(item.slug)');
    expect(hierarchySource).toContain('publicRoutes.questions.index({ materia: item.name })');
  });

  it('renders the directories inside the canonical platform shell and links them publicly', () => {
    const shelllessRoutes = frameSource.slice(
      frameSource.indexOf('const ROUTES_WITHOUT_PLATFORM_SHELL'),
      frameSource.indexOf('const isWithoutPlatformShell'),
    );
    expect(shelllessRoutes).not.toContain("'/disciplinas'");
    expect(shelllessRoutes).not.toContain("'/bancas'");
    expect(directorySource).not.toContain('PublicTaxonomyHeader');
    expect(directorySource).not.toContain('PublicTaxonomyFooter');
    expect(landingSource).toContain("{ label: 'Disciplinas', href: '/disciplinas' }");
    expect(landingSource).toContain("{ label: 'Bancas', href: '/bancas' }");
    expect(footerSource).toContain("path: '/disciplinas'");
    expect(footerSource).toContain("path: '/bancas'");
  });

  it('does not use the broad administrative taxonomy contract', () => {
    expect(serverDataSource).not.toContain('filtersList');
    expect(serverDataSource).not.toContain('adminFiltersList');
  });

  it('gives each board a server-rendered public profile with objective statistics', () => {
    const boardPage = readSource('src/app/bancas/[slug]/page.tsx');
    const questionCard = readSource('src/app/questions/components/QuestionCard.tsx');
    const examPage = readSource('src/app/blog/provas/[slug]/page.tsx');

    expect(serverDataSource).toContain("filters/board.php");
    expect(directorySource).toContain('buildBoardPath(item)');
    expect(boardPage).not.toContain("'use client'");
    expect(boardPage).toContain('Inscrições abertas');
    expect(boardPage).toContain('Características na base');
    expect(boardPage).toContain('examSummary.completed');
    expect(boardPage).toContain("publicRoutes.questions.index({ agency: board.acronym || board.name })");
    expect(questionCard).toContain('buildBoardPath(board)');
    expect(examPage).toContain('buildBoardPath(exam.board)');
  });
});
