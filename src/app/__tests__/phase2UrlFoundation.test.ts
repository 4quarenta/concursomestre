import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (...segments: string[]) => fs.readFileSync(path.join(process.cwd(), ...segments), 'utf8');

describe('Phase 2 coordinated URL cutover', () => {
  it('delegates the new question collection to the existing practice implementation', () => {
    const page = source('src', 'app', 'questoes', 'page.tsx');
    expect(page).toContain("from '../practice/PracticePage'");
    expect(page).toContain('<PracticePage {...props} />');
    expect(source('src', 'app', 'practice', 'PracticePage.tsx')).toContain('fetchPracticeInitialQuestions');
  });

  it('uses one server resolver and corrects only the new question family slug', () => {
    const page = source('src', 'app', 'questoes', '[id]', '[[...slug]]', 'page.tsx');
    expect(page).toContain('fetchPublicQuestionRoute');
    expect(page).toContain('publicRoutes.questions.detail');
    expect(page).toContain('routeFamily="future"');
  });

  it('delegates the new exam routes without normalizing persisted exam slugs', () => {
    const indexPage = source('src', 'app', 'provas', 'page.tsx');
    const detailPage = source('src', 'app', 'provas', '[slug]', 'page.tsx');
    expect(indexPage).toContain("from '../blog/provas/page'");
    expect(detailPage).toContain("from '../../blog/provas/[slug]/page'");
    expect(detailPage).not.toContain('slugify');
  });

  it('keeps old and new exam routes in the same global frame', () => {
    const frame = source('src', 'providers', 'NextRouteFrame.tsx');
    const notifications = source('src', 'providers', 'NotificationsProvider.tsx');
    expect(frame).toContain('resolveExamPublicRouteCompatibility(pathname)?.withoutPlatformShell');
    expect(notifications).toContain('resolveExamPublicRouteCompatibility(pathname)?.skipNotificationBootstrap');
  });

  it('turns legacy question routes into direct permanent aliases', () => {
    const practice = source('src', 'app', 'practice', 'page.tsx');
    const questions = source('src', 'app', 'questions', 'page.tsx');
    const detail = source('src', 'app', 'question', '[id]', '[[...slug]]', 'page.tsx');
    expect(practice).toContain('permanentRedirect(publicRoutes.questions.index');
    expect(questions).toContain('permanentRedirect(publicRoutes.questions.index');
    expect(detail).toContain('fetchPublicQuestionRoute');
    expect(detail).toContain('permanentRedirect(publicRoutes.questions.detail');
    expect(source('next.config.ts')).not.toContain("destination: '/practice'");
  });

  it('moves canonical presentation and the operational sitemap to the new families', () => {
    expect(source('src', 'app', 'practice', 'layout.tsx')).toContain("path: '/questoes'");
    expect(source('src', 'app', 'questoes', '[id]', '[[...slug]]', 'page.tsx')).toContain('buildQuestionMetadata');
    expect(source('src', 'app', 'blog', 'provas', 'page.tsx')).toContain('publicRoutes.exams.index()');
    expect(source('src', 'app', 'blog', 'provas', '[slug]', 'page.tsx')).toContain('publicRoutes.exams.detail(exam.slug)');
    expect(source('src', 'services', 'seo', 'sitemapData.ts')).toContain("{ path: '/questoes'");
    expect(source('src', 'services', 'seo', 'sitemapData.ts')).toContain("{ path: '/provas'");
    expect(source('src', 'services', 'seo', 'sitemapData.ts')).not.toContain("{ path: '/practice'");
  });
});
