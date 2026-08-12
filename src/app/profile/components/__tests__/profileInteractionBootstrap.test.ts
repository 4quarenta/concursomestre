import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('profile interaction bootstrap', () => {
  it('does not server-render dead profile controls before the client module is interactive', () => {
    const routeSource = readSource('src/app/profile/ProfileRouteClient.tsx');
    const rootPageSource = readSource('src/app/profile/page.tsx');
    const tabPageSource = readSource('src/app/profile/[tab]/page.tsx');
    const skeletonSource = readSource('src/components/shared/feedback/RouteContentSkeleton.tsx');

    expect(routeSource).toContain('ssr: false');
    expect(routeSource).toContain('requestAnimationFrame');
    expect(routeSource).not.toContain('requestIdleCallback');
    expect(routeSource).toContain('profile-interactive-loading');
    expect(routeSource).not.toContain('Preparando seu perfil');
    expect(skeletonSource).toContain('pointer-events-none');
    expect(skeletonSource).toContain('aria-hidden="true"');
    expect(rootPageSource).toContain("'./ProfileRouteClient'");
    expect(tabPageSource).toContain("'../ProfileRouteClient'");
  });

  it('loads expensive profile domains only for the tab that consumes them', () => {
    const profileSource = readSource('src/app/profile/ProfilePage.tsx');

    expect(profileSource).toContain("activeTab === 'saved-questions' || activeTab === 'evolution'");
    expect(profileSource).toContain("activeTab === 'notebook'");
    expect(profileSource).toContain('includeComments: false');
    expect(profileSource).toContain("if (!showGoalModal)");
    expect(profileSource).toContain("activeTab !== 'notebook'");
  });

  it('loads saved questions from the authenticated database scope with cursor pagination', () => {
    const profileSource = readSource('src/app/profile/ProfilePage.tsx');
    const practiceSource = readSource('src/app/practice/PracticeClient.tsx');
    const authSource = readSource('src/providers/AuthProvider.tsx');

    expect(profileSource).toContain('useInfiniteQuery');
    expect(profileSource).toContain('onlySaved: true');
    expect(profileSource).toContain("content_scope: 'list'");
    expect(profileSource).toContain('lastPage.pageInfo.nextCursor');
    expect(profileSource).not.toContain('missingSavedQuestionIds.map');
    expect(practiceSource).toContain('question.isSaved');
    expect(practiceSource).toContain('resolveQuestionSavedState');
    expect(authSource).toContain('desiredSavedState ?? !wasSaved');
  });

  it('keeps Recharts out of the initial profile module', () => {
    const profileSource = readSource('src/app/profile/ProfilePage.tsx');
    const chartSource = readSource('src/app/profile/components/ProfileEvolutionChart.tsx');

    expect(profileSource).not.toContain("from 'recharts'");
    expect(profileSource).toContain("dynamic(() => import('./components/ProfileEvolutionChart')");
    expect(chartSource).toContain("from 'recharts'");
  });

  it('hides saved annotated laws and redirects their direct profile route when the module is disabled', () => {
    const profileSource = readSource('src/app/profile/ProfilePage.tsx');

    expect(profileSource).toContain("resolveSystemFeatureFlag(systemSettings, 'annotatedLawsEnabled', false)");
    expect(profileSource).toContain("tab === 'favorite-laws' && isSystemSettingsLoaded && !annotatedLawsEnabled");
    expect(profileSource).toContain("annotatedLawsEnabled && renderSidebarItem({ id: 'favorite-laws'");
    expect(profileSource).toContain("annotatedLawsEnabled && activeTab === 'favorite-laws'");
    expect(profileSource).toContain("activeTab === 'favorite-laws' && annotatedLawsEnabled");
  });
});
