import type { DashboardOverviewProps } from '../DashboardOverview';
import { calculateLevelProgress } from '@/services/dashboard/dashboardInsightsService';

export const dashboardFixture: DashboardOverviewProps = {
  name: 'João', range: 'month', onRangeChange: () => {}, loading: false,
  summary: { totalQuestions: 320, correctAnswers: 250, wrongAnswers: 70, accuracyRate: 78 },
  timeline: Array.from({ length: 15 }, (_, index) => ({ date: `${index + 1} out`, timestamp: index, questions: index + 5, correct: index + 2, wrong: 3 })),
  subjects: [
    { name: 'Língua Portuguesa', total: 120, correct: 102, wrong: 18, accuracy: 85 },
    { name: 'Direito Constitucional', total: 80, correct: 64, wrong: 16, accuracy: 80 },
    { name: 'Informática', total: 70, correct: 49, wrong: 21, accuracy: 70 },
    { name: 'Raciocínio Lógico', total: 50, correct: 35, wrong: 15, accuracy: 70 },
  ],
  level: calculateLevelProgress(2450, 12),
  streak: { current: 7, best: 12, lastVisitDate: '2026-10-21', visitedDateKeys: ['2026-10-19', '2026-10-20', '2026-10-21'] },
  totals: { totalSeconds: 67200, readingSeconds: 30000, questionSeconds: 37200 },
  studyLoading: false, averageSeconds: 2240, comments: 12,
  motivation: 'Um passo por dia também é progresso.', date: '21 de outubro de 2026',
  insight: { title: 'Bom nível de precisão', description: 'Continue revisando os assuntos em que teve mais dificuldade.', tone: 'emerald' },
};
