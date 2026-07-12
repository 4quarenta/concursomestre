import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const dashboardSource = readFileSync(
  resolve(process.cwd(), 'src/app/dashboard/DashboardPage.tsx'),
  'utf8',
);

describe('Dashboard initial activity requests', () => {
  it('uses server summaries and a short answer page instead of downloading history', () => {
    expect(dashboardSource).toContain('getCurrentUserAnswersPage({ limit: 20, range: timeRange })');
    expect(dashboardSource).not.toContain('getCurrentUserAnswers(240)');
    expect(dashboardSource).toContain('effectiveDashboardAnswerPage.summary.totalAttempts');
    expect(dashboardSource).toContain('effectiveDashboardAnswerPage.summary.firstActivityAt');
  });

  it('uses only the comment count summary for the dashboard card', () => {
    expect(dashboardSource).toContain('getCurrentUserCommentsPage({ limit: 1, range: timeRange })');
    expect(dashboardSource).toContain('setDashboardCommentsCount(page.totalComments)');
    expect(dashboardSource).not.toContain('getCurrentUserComments(20)');
  });
});
