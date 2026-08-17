import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('study route interaction bootstrap', () => {
  it.each([
    ['dashboard', 'DashboardRouteClient', 'dashboard-interactive-loading'],
    ['simulation', 'SimulationRouteClient', 'simulation-interactive-loading'],
  ])('loads %s progressively behind a non-blocking skeleton', (route, clientModule, testId) => {
    const pageSource = readSource(`src/app/${route}/page.tsx`);
    const clientSource = readSource(`src/app/${route}/${clientModule}.tsx`);
    const skeletonSource = readSource('src/components/shared/feedback/RouteContentSkeleton.tsx');

    expect(pageSource).toContain(`'./${clientModule}'`);
    expect(clientSource).toContain('ssr: false');
    expect(clientSource).toContain(testId);
    expect(skeletonSource).toContain('pointer-events-none');
    expect(skeletonSource).toContain('aria-hidden="true"');
  });

  it('keeps Practice server-rendered while splitting expensive interactive children', () => {
    const pageSource = readSource('src/app/practice/PracticePage.tsx');
    const clientSource = readSource('src/app/practice/PracticeClient.tsx');

    expect(pageSource).toContain('fetchPracticeInitialQuestions');
    expect(pageSource).toMatch(/<PracticeClient\s+initialQuestionPage=\{initialQuestionPage\}\s+semanticPageHeaderRendered/);
    expect(pageSource).toContain('PracticePublicCollectionFallback');
    expect(clientSource).toMatch(/useEffect\(\(\) => \{\s*if \(authIsLoading\) \{\s*return;/);
    expect(clientSource).toContain("dynamic(() => import('../questions/components/QuestionCard')");
    expect(clientSource).toContain("dynamic(() => import('../../components/shared/overlays/AuthModal')");
    expect(clientSource).toContain("dynamic(() => import('@/components/shared/overlays/UpgradeModal')");
  });
});
