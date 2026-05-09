'use client';

/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  BookOpen,
  Crown,
  Lock,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import AuthModal from '../../components/shared/overlays/AuthModal';
import UpgradeModal from '../../components/shared/overlays/UpgradeModal';
import {
  PLATFORM_PAGE_DESCRIPTION_CLASS,
  PLATFORM_PAGE_TITLE_CLASS,
  PLATFORM_SECTION_TITLE_CLASS,
} from '@constants/layout';
import { useAuth } from '@providers/AuthProvider';
import { useQuestionBankActions } from '@/state/question-bank/useQuestionBankActions';
import { useUserProgressActions } from '@/state/user-progress/useUserProgressActions';
import {
  buildSubjectPeerComparisonData,
  buildSubjectPerformanceData,
  buildSubjectPerformanceDataFromStatistics,
  buildSubjectPerformanceInsight,
  calculateAccuracySummary,
  type DashboardPerformanceInsight,
  type DashboardSubjectPeerMetric,
} from '@services/dashboard/dashboardInsightsService';
import { isPlanAtLeast } from '@services/plans/planAccess';
import { useStudyTracker } from '@providers/StudyTrackerProvider';

interface SubjectInsightRow {
  name: string;
  total: number;
  correct: number;
  wrong: number;
  accuracy: number;
  peerMetric: DashboardSubjectPeerMetric | null;
  insight: DashboardPerformanceInsight;
}

const PANEL_CLASS = 'rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900';
const MUTED_PANEL_CLASS = 'rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/50';

const INSIGHT_TONE_CLASSES: Record<DashboardPerformanceInsight['tone'], {
  accent: string;
  badge: string;
  bar: string;
  icon: string;
}> = {
  emerald: {
    accent: 'border-l-emerald-500',
    badge: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-500/20',
    bar: 'bg-emerald-500',
    icon: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300',
  },
  amber: {
    accent: 'border-l-amber-500',
    badge: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/20',
    bar: 'bg-amber-500',
    icon: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300',
  },
  rose: {
    accent: 'border-l-rose-500',
    badge: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-200 dark:ring-rose-500/20',
    bar: 'bg-rose-500',
    icon: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300',
  },
  indigo: {
    accent: 'border-l-indigo-500',
    badge: 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-200 dark:ring-indigo-500/20',
    bar: 'bg-indigo-500',
    icon: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300',
  },
};

const formatPercent = (value: number) => `${Math.max(0, Math.min(100, Math.round(Number(value || 0))))}%`;

const getComparisonDelta = (subject: SubjectInsightRow): number | null => {
  if (!subject.peerMetric || subject.peerMetric.total <= 0) {
    return null;
  }

  return subject.accuracy - subject.peerMetric.accuracy;
};

const getComparisonLabel = (subject: SubjectInsightRow): string => {
  const delta = getComparisonDelta(subject);

  if (delta === null) {
    return 'Sem base';
  }

  if (delta === 0) {
    return 'Mesmo nível';
  }

  return `${Math.abs(delta)} p.p. ${delta > 0 ? 'acima' : 'abaixo'}`;
};

const getComparisonToneClass = (subject: SubjectInsightRow): string => {
  const delta = getComparisonDelta(subject);

  if (delta === null) {
    return 'bg-slate-100 text-slate-500 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700';
  }

  return delta >= 0
    ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-500/20'
    : 'bg-rose-50 text-rose-700 ring-1 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-200 dark:ring-rose-500/20';
};

const MetricBox = ({
  label,
  value,
  helper,
}: {
  label: string;
  value: string | number;
  helper?: string;
}) => (
  <div className={`${PANEL_CLASS} px-4 py-3`}>
    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">{label}</p>
    <p className="mt-1 text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">{value}</p>
    {helper ? <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{helper}</p> : null}
  </div>
);

const AccuracyBar = ({
  value,
  barClassName,
}: {
  value: number;
  barClassName: string;
}) => (
  <div className="flex min-w-0 items-center gap-3">
    <div className="h-2.5 min-w-[84px] flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
      <div className={`h-full rounded-full ${barClassName}`} style={{ width: formatPercent(value) }} />
    </div>
    <span className="w-10 shrink-0 text-right text-xs font-black text-slate-700 dark:text-slate-200">
      {formatPercent(value)}
    </span>
  </div>
);

/**
 * Pagina detalhada de desempenho por materia.
 * Ela expande o card do dashboard para listar todos os indicadores do usuario por materia.
 *
 * @since 1.0.0
 */
const PerformanceSubjectsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { statistics: userStatistics } = useStudyTracker();
  const { userAnswers, ensureUserProgressLoaded } = useUserProgressActions();
  const { questions, ensureQuestionsLoaded } = useQuestionBankActions();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  React.useEffect(() => {
    ensureUserProgressLoaded(false, {
      includeAnswers: true,
      includeComments: false,
      includeNotes: false,
    });
  }, [ensureUserProgressLoaded]);

  React.useEffect(() => {
    void ensureQuestionsLoaded();
  }, [ensureQuestionsLoaded]);

  const subjectMetricsFromAnswers = useMemo(
    () => buildSubjectPerformanceData(userAnswers, questions),
    [questions, userAnswers],
  );

  const subjectMetricsFromStatistics = useMemo(
    () => buildSubjectPerformanceDataFromStatistics(userStatistics?.subjectBreakdown),
    [userStatistics?.subjectBreakdown],
  );

  const subjectMetrics = useMemo(
    () => (subjectMetricsFromAnswers.length > 0 ? subjectMetricsFromAnswers : subjectMetricsFromStatistics),
    [subjectMetricsFromAnswers, subjectMetricsFromStatistics],
  );

  const summaryFromAnswers = useMemo(
    () => calculateAccuracySummary(userAnswers),
    [userAnswers],
  );

  const summary = useMemo(() => {
    if (summaryFromAnswers.totalQuestions > 0) {
      return summaryFromAnswers;
    }

    if (subjectMetrics.length <= 0) {
      return summaryFromAnswers;
    }

    const totalQuestions = subjectMetrics.reduce((total, subject) => total + subject.total, 0);
    const correctAnswers = subjectMetrics.reduce((total, subject) => total + subject.correct, 0);
    const wrongAnswers = subjectMetrics.reduce((total, subject) => total + subject.wrong, 0);
    const accuracyRate = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;

    return {
      totalQuestions,
      correctAnswers,
      wrongAnswers,
      accuracyRate,
    };
  }, [subjectMetrics, summaryFromAnswers]);

  const peerMetricsBySubject = useMemo(
    () => buildSubjectPeerComparisonData(questions, subjectMetrics),
    [questions, subjectMetrics],
  );

  const subjectInsightRows = useMemo<SubjectInsightRow[]>(() => subjectMetrics.map((subject) => {
    const peerMetric = peerMetricsBySubject.get(subject.name) || null;

    return {
      ...subject,
      peerMetric,
      insight: buildSubjectPerformanceInsight(subject, peerMetric),
    };
  }), [peerMetricsBySubject, subjectMetrics]);

  const highlightedInsights = useMemo(() => {
    const priority: Record<DashboardPerformanceInsight['tone'], number> = {
      rose: 4,
      amber: 3,
      emerald: 2,
      indigo: 1,
    };

    return [...subjectInsightRows]
      .sort((left, right) => (
        priority[right.insight.tone] - priority[left.insight.tone]
        || right.total - left.total
      ))
      .slice(0, 5);
  }, [subjectInsightRows]);

  const subjectsWithPeerData = useMemo(
    () => subjectInsightRows.filter((subject) => subject.peerMetric && subject.peerMetric.total > 0).length,
    [subjectInsightRows],
  );

  const hasEliteAccess = isPlanAtLeast(currentUser, 'Elite');

  if (!hasEliteAccess) {
    return (
      <>
        <div className="mx-auto max-w-5xl space-y-6 animate-fade-in">
          <header className="space-y-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-600 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <ArrowLeft size={14} />
              Voltar ao dashboard
            </Link>
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-600 dark:text-amber-300">
                Recurso exclusivo Elite
              </p>
              <h1 className={PLATFORM_PAGE_TITLE_CLASS}>Insight por matérias</h1>
              <p className={PLATFORM_PAGE_DESCRIPTION_CLASS}>
                Compare seu desempenho por matéria com outros alunos e veja onde ajustar a rota de estudo.
              </p>
            </div>
          </header>

          <section className={`${PANEL_CLASS} overflow-hidden`}>
            <div className="grid gap-0 lg:grid-cols-[1fr,320px]">
              <div className="space-y-5 p-6 md:p-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
                  <Lock size={24} />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-slate-100">
                    Desbloqueie a leitura por matéria
                  </h2>
                  <p className="max-w-2xl text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">
                    O plano Elite libera comparação com a base geral, prioridades de revisão e leitura por volume de questões.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!currentUser) {
                      setShowAuthModal(true);
                      return;
                    }

                    setShowUpgradeModal(true);
                  }}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 text-[10px] font-black uppercase tracking-[0.14em] text-white transition-colors hover:bg-amber-600"
                >
                  <Crown size={15} />
                  Quero ser Elite
                </button>
              </div>

              <div className="border-t border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-950/50 lg:border-l lg:border-t-0">
                <div className="grid gap-3">
                  {[
                    'Comparação por matéria',
                    'Prioridade de revisão',
                    'Base geral dos alunos',
                    'Precisão por volume',
                  ].map((item) => (
            <div key={item} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
                      <Crown size={14} className="text-amber-500" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>

        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          title="Entre para ver os insights por matéria"
          description="Acesse sua conta para acompanhar o desempenho detalhado e liberar recursos do plano Elite."
        />
        <UpgradeModal
          isOpen={showUpgradeModal}
          onClose={() => setShowUpgradeModal(false)}
          requiredPlan="Elite"
          featureName="Insights por matéria"
        />
      </>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 animate-fade-in">
      <header className="space-y-5">
        <Link
          href="/"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-600 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <ArrowLeft size={14} />
          Voltar ao dashboard
        </Link>

        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl space-y-2">
          <div className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
              <Crown size={13} />
              Exclusivo Elite
            </div>
            <h1 className={PLATFORM_PAGE_TITLE_CLASS}>Insight por matérias</h1>
            <p className={PLATFORM_PAGE_DESCRIPTION_CLASS}>
              Desempenho por matéria com comparação da base geral e indicação de prioridade.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[520px] xl:grid-cols-4">
            <MetricBox label="Matérias" value={subjectMetrics.length} />
            <MetricBox label="Questões" value={summary.totalQuestions} />
            <MetricBox label="Precisão" value={formatPercent(summary.accuracyRate)} />
            <MetricBox label="Com base" value={subjectsWithPeerData} />
          </div>
        </div>
      </header>

      <section className={`${PANEL_CLASS} overflow-hidden`}>
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
              <Sparkles size={18} />
            </div>
            <div>
              <h2 className={PLATFORM_SECTION_TITLE_CLASS}>Prioridades</h2>
              <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                Ordenado pelo que mais merece atenção agora.
              </p>
            </div>
          </div>
        </div>

        {highlightedInsights.length > 0 ? (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {highlightedInsights.map((subject) => {
              const toneClasses = INSIGHT_TONE_CLASSES[subject.insight.tone];
              const delta = getComparisonDelta(subject);

              return (
                <article key={subject.name} className={`border-l-4 ${toneClasses.accent} px-5 py-4`}>
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr),minmax(260px,0.9fr),minmax(220px,0.8fr)] lg:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-base font-black text-slate-900 dark:text-slate-100">{subject.name}</h3>
                        <span className={`rounded-xl px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${toneClasses.badge}`}>
                          {subject.insight.title}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">
                        {subject.insight.description}
                      </p>
                    </div>

                    <div className={`${MUTED_PANEL_CLASS} p-3`}>
                      <div className="grid gap-3">
                        <div>
                          <div className="mb-1 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                            <span>Você</span>
                            <span>{subject.correct}/{subject.total}</span>
                          </div>
                          <AccuracyBar value={subject.accuracy} barClassName={toneClasses.bar} />
                        </div>
                        <div>
                          <div className="mb-1 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                            <span>Outros alunos</span>
                            <span>{subject.peerMetric?.total || 0} respostas</span>
                          </div>
                          <AccuracyBar value={subject.peerMetric?.accuracy || 0} barClassName="bg-slate-500 dark:bg-slate-400" />
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                      <span className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] ${getComparisonToneClass(subject)}`}>
                        {delta !== null && delta < 0 ? <TrendingDown size={13} /> : <TrendingUp size={13} />}
                        {getComparisonLabel(subject)}
                      </span>
                      <span className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                        <BookOpen size={13} />
                        {subject.total} questões
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="px-6 py-10 text-center">
            <AlertTriangle className="mx-auto text-slate-300 dark:text-slate-600" size={32} />
            <p className="mt-3 text-base font-bold text-slate-700 dark:text-slate-200">Ainda não há insight por matéria.</p>
            <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">Resolva questões para liberar a leitura comparativa.</p>
          </div>
        )}
      </section>

      <section className={`${PANEL_CLASS} overflow-hidden`}>
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <BarChart3 size={18} />
            </div>
            <div>
              <h2 className={PLATFORM_SECTION_TITLE_CLASS}>Tabela completa</h2>
              <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                Visão consolidada por matéria.
              </p>
            </div>
          </div>
        </div>

        {subjectInsightRows.length > 0 ? (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 dark:bg-slate-950/60 dark:text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Matéria</th>
                    <th className="px-5 py-3">Questões</th>
                    <th className="px-5 py-3">Acertos</th>
                    <th className="px-5 py-3">Erros</th>
                    <th className="px-5 py-3">Você</th>
                    <th className="px-5 py-3">Outros alunos</th>
                    <th className="px-5 py-3">Comparação</th>
                    <th className="px-5 py-3">Insight</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {subjectInsightRows.map((subject) => {
                    const toneClasses = INSIGHT_TONE_CLASSES[subject.insight.tone];
                    const delta = getComparisonDelta(subject);

                    return (
                      <tr key={subject.name} className="align-middle text-slate-700 dark:text-slate-200">
                        <td className="max-w-[260px] px-5 py-4">
                          <p className="truncate font-black text-slate-900 dark:text-slate-100">{subject.name}</p>
                        </td>
                        <td className="px-5 py-4 font-bold">{subject.total}</td>
                        <td className="px-5 py-4 font-bold text-emerald-600 dark:text-emerald-300">{subject.correct}</td>
                        <td className="px-5 py-4 font-bold text-rose-600 dark:text-rose-300">{subject.wrong}</td>
                        <td className="min-w-[180px] px-5 py-4">
                          <AccuracyBar value={subject.accuracy} barClassName={toneClasses.bar} />
                        </td>
                        <td className="min-w-[180px] px-5 py-4">
                          {subject.peerMetric && subject.peerMetric.total > 0 ? (
                            <div className="space-y-1">
                              <AccuracyBar value={subject.peerMetric.accuracy} barClassName="bg-slate-500 dark:bg-slate-400" />
                              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
                                {subject.peerMetric.total} respostas
                              </p>
                            </div>
                          ) : (
                      <span className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                              <Users size={12} />
                              Sem base
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] ${getComparisonToneClass(subject)}`}>
                            {delta !== null && delta < 0 ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
                            {getComparisonLabel(subject)}
                          </span>
                        </td>
                        <td className="max-w-[320px] px-5 py-4">
                      <span className={`inline-flex rounded-xl px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${toneClasses.badge}`}>
                            {subject.insight.title}
                          </span>
                          <p className="mt-2 line-clamp-2 text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">
                            {subject.insight.description}
                          </p>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-slate-200 dark:divide-slate-800 lg:hidden">
              {subjectInsightRows.map((subject) => {
                const toneClasses = INSIGHT_TONE_CLASSES[subject.insight.tone];
                const delta = getComparisonDelta(subject);

                return (
                  <article key={subject.name} className="space-y-4 px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-black text-slate-900 dark:text-slate-100">{subject.name}</h3>
                        <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                          {subject.correct} acertos, {subject.wrong} erros
                        </p>
                      </div>
                    <span className={`shrink-0 rounded-xl px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${toneClasses.badge}`}>
                        {subject.insight.title}
                      </span>
                    </div>

                    <div className="grid gap-3">
                      <div>
                        <div className="mb-1 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                          <span>Você</span>
                          <span>{subject.total} questões</span>
                        </div>
                        <AccuracyBar value={subject.accuracy} barClassName={toneClasses.bar} />
                      </div>
                      <div>
                        <div className="mb-1 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                          <span>Outros alunos</span>
                          <span>{subject.peerMetric?.total || 0} respostas</span>
                        </div>
                        <AccuracyBar value={subject.peerMetric?.accuracy || 0} barClassName="bg-slate-500 dark:bg-slate-400" />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                    <span className={`inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] ${getComparisonToneClass(subject)}`}>
                        {delta !== null && delta < 0 ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
                        {getComparisonLabel(subject)}
                      </span>
                    </div>
                    <p className="text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">{subject.insight.description}</p>
                  </article>
                );
              })}
            </div>
          </>
        ) : (
          <div className="px-6 py-12 text-center">
            <AlertTriangle className="mx-auto text-slate-300 dark:text-slate-600" size={32} />
            <p className="mt-3 text-base font-bold text-slate-700 dark:text-slate-200">Nenhuma matéria consolidada ainda.</p>
            <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">Resolva questões para preencher esta análise detalhada.</p>
          </div>
        )}
      </section>
    </div>
  );
};

export default PerformanceSubjectsPage;
