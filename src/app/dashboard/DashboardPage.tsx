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
import { Crown, Lock } from 'lucide-react';
import DashboardOverview from './DashboardOverview';
import { useAppConfigStore } from '@/state/app-config/appConfigStore';
import { useAuth } from '@providers/AuthProvider';
import { useStudyTracker } from '@providers/StudyTrackerProvider';
import { commentService } from '@services/comments';
import { userProgressService, type CurrentUserAnswersPage } from '@services/progress';
import AuthModal from '../../components/shared/overlays/AuthModal';
import UpgradeModal from '../../components/shared/overlays/UpgradeModal';
import ui from '@/components/shared/ui/PlatformUI.module.css';
import {
  buildAccuracyInsight,
  buildQuestionTimelineData,
  buildSubjectPerformanceDataFromAnswers,
  buildSubjectPerformanceDataFromStatistics,
  calculateLevelProgress,
  formatDashboardDate,
  getDailyMotivationForDate,
  resolveDashboardAnswerTimestamp,
  type DashboardTimeRange,
} from '@services/dashboard/dashboardInsightsService';
import { loadDailyMotivationMarkdown } from '@services/dashboard/dailyMotivationContentService';
import { getStudyStreakSnapshot, touchStudyStreak, type StudyStreakSnapshot } from '@services/dashboard/studyStreakService';
import { getBenefitRequiredPlan, hasPlanBenefit, type CanonicalPlanName } from '@services/plans/planAccess';

const EMPTY_DASHBOARD_ANSWER_PAGE: CurrentUserAnswersPage = {
  items: [],
  hasMore: false,
  nextCursor: null,
  summary: {
    totalAttempts: 0,
    correct: 0,
    wrong: 0,
    accuracy: 0,
    firstActivityAt: null,
    lastActivityAt: null,
  },
};

const EMPTY_STREAK: StudyStreakSnapshot = {
  current: 0,
  best: 0,
  lastVisitDate: '',
  visitedDateKeys: [],
};
const MILLISECONDS_PER_DAY = 86_400_000;

const hasSpecificSubjectMetric = (metrics: Array<{ name: string }>): boolean => (
  metrics.some((metric) => {
    const normalizedName = metric.name.trim().toLowerCase();
    return normalizedName !== '' && normalizedName !== 'geral';
  })
);

const scheduleLowPriorityTask = (task: () => void): (() => void) => {
  if (typeof window === 'undefined') {
    return () => {};
  }

  if (typeof window.requestIdleCallback === 'function') {
    const requestId = window.requestIdleCallback(() => {
      task();
    }, { timeout: 1500 });

    return () => {
      window.cancelIdleCallback(requestId);
    };
  }

  const timeoutId = window.setTimeout(task, 180);
  return () => {
    window.clearTimeout(timeoutId);
  };
};

/**
 * Dashboard principal do usuario autenticado.
 * Ele resume atividade, motivacao, sequencia, nivel e desempenho por materia em um unico painel.
 *
 * @since 1.0.0
 */
const Dashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const systemSettings = useAppConfigStore((state) => state.systemSettings);
  const { displayTotals, isLoading: isStudyTimeLoading, statistics: userStatistics } = useStudyTracker();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [timeRange, setTimeRange] = useState<DashboardTimeRange>('today');
  const [fallbackDailyMotivationMarkdown, setFallbackDailyMotivationMarkdown] = useState<string>('');
  const [dashboardAnswerPage, setDashboardAnswerPage] = useState<CurrentUserAnswersPage>(EMPTY_DASHBOARD_ANSWER_PAGE);
  const [dashboardAnswersOwnerKey, setDashboardAnswersOwnerKey] = useState<string | null>(null);
  const [dashboardCommentsCount, setDashboardCommentsCount] = useState(0);
  const [dashboardCommentsOwnerKey, setDashboardCommentsOwnerKey] = useState<string | null>(null);
  const [studyStreak, setStudyStreak] = useState<StudyStreakSnapshot>(() => (
    currentUser?.id ? getStudyStreakSnapshot(currentUser.id) : EMPTY_STREAK
  ));
  const hasDashboardAccess = hasPlanBenefit(currentUser, 'module.dashboard', systemSettings.planEntitlements);
  const dashboardRequiredPlan = getBenefitRequiredPlan('module.dashboard', systemSettings.planEntitlements) as CanonicalPlanName;
  const dashboardActivityKey = currentUser?.id ? `${currentUser.id}:${timeRange}` : null;

  /**
   * O dashboard precisa apenas das respostas para renderizar cards e grafico.
   * Comentários e notas ficam fora do primeiro paint e comentários só entram sob demanda.
   *
   * @since 1.0.0
   */
  React.useEffect(() => {
    if (!currentUser?.id || !hasDashboardAccess) {
      return;
    }

    if (dashboardActivityKey && dashboardAnswersOwnerKey === dashboardActivityKey) {
      return;
    }

    let isMounted = true;
    let cancelScheduledFetch: (() => void) | null = null;
    const timeoutId = window.setTimeout(() => {
      cancelScheduledFetch = scheduleLowPriorityTask(() => {
        userProgressService.getCurrentUserAnswersPage({ limit: 20, range: timeRange })
          .then((page) => {
            if (isMounted) {
              setDashboardAnswerPage(page);
              setDashboardAnswersOwnerKey(dashboardActivityKey);
            }
          })
          .catch(() => {
            if (isMounted) {
              setDashboardAnswerPage(EMPTY_DASHBOARD_ANSWER_PAGE);
              setDashboardAnswersOwnerKey(dashboardActivityKey);
            }
          });
      });
    }, 0);

    return () => {
      isMounted = false;
      window.clearTimeout(timeoutId);
      if (cancelScheduledFetch) {
        cancelScheduledFetch();
      }
    };
  }, [currentUser?.id, dashboardActivityKey, dashboardAnswersOwnerKey, hasDashboardAccess, timeRange]);

  React.useEffect(() => {
    if (
      !currentUser?.id
      || !hasDashboardAccess
    ) {
      return;
    }

    if (dashboardActivityKey && dashboardCommentsOwnerKey === dashboardActivityKey) {
      return;
    }

    let isMounted = true;
    commentService.getCurrentUserCommentsPage({ limit: 1, range: timeRange })
      .then((page) => {
        if (isMounted) {
          setDashboardCommentsCount(page.totalComments);
          setDashboardCommentsOwnerKey(dashboardActivityKey);
        }
      })
      .catch(() => {
        if (isMounted) {
          setDashboardCommentsCount(0);
          setDashboardCommentsOwnerKey(dashboardActivityKey);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [currentUser?.id, dashboardActivityKey, dashboardCommentsOwnerKey, hasDashboardAccess, timeRange]);

  /**
   * Atualiza a base de motivacoes conforme o admin salva um markdown novo.
   * Na ausencia de configuracao, carrega o arquivo padrao com 365 frases.
   *
   * @since 1.0.0
   */
  React.useEffect(() => {
    const configuredMarkdown = String(systemSettings.dailyMotivationMarkdown || '').trim();
    if (configuredMarkdown !== '') {
      return;
    }

    let isMounted = true;
    const cancelScheduledFetch = scheduleLowPriorityTask(() => {
      loadDailyMotivationMarkdown()
        .then((markdown) => {
          if (isMounted) {
            setFallbackDailyMotivationMarkdown(markdown);
          }
        })
        .catch(() => {
          if (isMounted) {
            setFallbackDailyMotivationMarkdown('');
          }
        });
    });

    return () => {
      isMounted = false;
      cancelScheduledFetch();
    };
  }, [systemSettings.dailyMotivationMarkdown]);

  /**
   * Marca a visita diaria do usuario para manter a sequencia de estudos.
   * O contador permanece no navegador atual e zera quando um dia inteiro e perdido.
   *
   * @since 1.0.0
   */
  React.useEffect(() => {
    if (!currentUser?.id) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      setStudyStreak(touchStudyStreak(currentUser.id));
    });

    return () => window.cancelAnimationFrame(frame);
  }, [currentUser?.id]);

  const effectiveDashboardAnswerPage = useMemo(
    () => (dashboardActivityKey && dashboardAnswersOwnerKey === dashboardActivityKey
      ? dashboardAnswerPage
      : EMPTY_DASHBOARD_ANSWER_PAGE),
    [dashboardActivityKey, dashboardAnswerPage, dashboardAnswersOwnerKey],
  );
  const effectiveDashboardAnswers = effectiveDashboardAnswerPage.items;

  const dailyMotivationMarkdown = useMemo(() => {
    const configuredMarkdown = String(systemSettings.dailyMotivationMarkdown || '').trim();
    if (configuredMarkdown !== '') {
      return configuredMarkdown;
    }

    return fallbackDailyMotivationMarkdown;
  }, [fallbackDailyMotivationMarkdown, systemSettings.dailyMotivationMarkdown]);

  // O servidor ja aplica o recorte; o browser mantem somente a amostra recente
  // necessaria para o grafico, sem baixar o historico integral de respostas.
  const filteredAnswers = effectiveDashboardAnswers;

  const accuracySummary = useMemo(
    () => ({
      totalQuestions: effectiveDashboardAnswerPage.summary.totalAttempts,
      correctAnswers: effectiveDashboardAnswerPage.summary.correct,
      wrongAnswers: effectiveDashboardAnswerPage.summary.wrong,
      accuracyRate: effectiveDashboardAnswerPage.summary.accuracy,
    }),
    [effectiveDashboardAnswerPage.summary],
  );

  const subjectMetrics = useMemo(
    () => {
      const metricsFromAnswers = buildSubjectPerformanceDataFromAnswers(filteredAnswers);
      if (timeRange !== 'all') {
        return metricsFromAnswers;
      }

      const metricsFromStatistics = buildSubjectPerformanceDataFromStatistics(userStatistics?.subjectBreakdown);
      if (metricsFromAnswers.length > 0 && (hasSpecificSubjectMetric(metricsFromAnswers) || metricsFromStatistics.length === 0)) {
        return metricsFromAnswers;
      }

      if (metricsFromStatistics.length > 0) {
        return metricsFromStatistics;
      }

      return metricsFromAnswers;
    },
    [filteredAnswers, timeRange, userStatistics?.subjectBreakdown],
  );

  const accuracyInsight = useMemo(
    () => buildAccuracyInsight(accuracySummary),
    [accuracySummary],
  );

  const timelineData = useMemo(
    () => buildQuestionTimelineData(filteredAnswers, timeRange),
    [filteredAnswers, timeRange],
  );

  const levelProgress = useMemo(
    () => calculateLevelProgress(currentUser?.xp, currentUser?.level),
    [currentUser?.level, currentUser?.xp],
  );

  const userCommentsCount = useMemo(() => {
    if (dashboardActivityKey && dashboardCommentsOwnerKey === dashboardActivityKey) {
      return dashboardCommentsCount;
    }

    return 0;
  }, [dashboardActivityKey, dashboardCommentsCount, dashboardCommentsOwnerKey]);

  const topSubjects = subjectMetrics.slice(0, 5);
  const currentStudyStreakDays = studyStreak.current;
  const averageDailyStudySeconds = useMemo(() => {
    const totalStudySeconds = Math.max(0, Number(displayTotals.totalSeconds || 0));
    if (totalStudySeconds <= 0) {
      return 0;
    }

    const firstAnswerTimestamp = resolveDashboardAnswerTimestamp(
      effectiveDashboardAnswerPage.summary.firstActivityAt
        ? { createdAt: effectiveDashboardAnswerPage.summary.firstActivityAt }
        : null,
    ) || (effectiveDashboardAnswers || [])
      .map(resolveDashboardAnswerTimestamp)
      .filter((timestamp) => Number.isFinite(timestamp) && timestamp > 0)
      .sort((left, right) => left - right)[0];

    let totalStudyDays = 1;
    if (firstAnswerTimestamp) {
      const firstStudyDay = new Date(firstAnswerTimestamp);
      firstStudyDay.setHours(0, 0, 0, 0);
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const elapsedDays = Math.floor((todayStart.getTime() - firstStudyDay.getTime()) / MILLISECONDS_PER_DAY);
      totalStudyDays = Math.max(1, elapsedDays + 1);
    } else if (currentStudyStreakDays > 0) {
      totalStudyDays = currentStudyStreakDays;
    } else if (userStatistics?.lastActivity) {
      totalStudyDays = 1;
    }

    return Math.max(0, Math.round(totalStudySeconds / totalStudyDays));
  }, [currentStudyStreakDays, displayTotals.totalSeconds, effectiveDashboardAnswerPage.summary.firstActivityAt, effectiveDashboardAnswers, userStatistics?.lastActivity]);

  const dailyMotivation = useMemo(
    () => getDailyMotivationForDate(dailyMotivationMarkdown, new Date()),
    [dailyMotivationMarkdown],
  );
  const formattedToday = useMemo(() => formatDashboardDate(new Date()), []);
  if (!hasDashboardAccess) {
    return (
      <>
        <div className={ui.scope}>
          <h1 className="text-2xl font-semibold">Seu painel de estudos</h1>
          <section className="mt-6 border-y border-slate-200 py-8 dark:border-slate-700">
            <Lock size={24} className="mb-4 text-slate-500" />
            <h2 className={ui.heading}>Acompanhe sua evolução</h2>
            <p className={`${ui.muted} mt-2 max-w-xl`}>
              Desempenho, tempo de estudo, constância e resultados por matéria.
              O acesso ao painel depende dos benefícios do seu plano.
            </p>
            <button
              type="button"
              onClick={() => {
                if (!currentUser) {
                  setShowAuthModal(true);
                  return;
                }
                setShowUpgradeModal(true);
              }}
              className={`${ui.action} mt-5`}
            >
              <Crown size={16} />
              {currentUser ? 'Ver planos' : 'Entrar na conta'}
            </button>
          </section>
        </div>

        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          title="Entre para desbloquear o dashboard premium"
          description="Acesse o painel completo do ConcursoMestre e acompanhe sua evolução conforme o plano liberado."
        />
        <UpgradeModal
          isOpen={showUpgradeModal}
          onClose={() => setShowUpgradeModal(false)}
          requiredPlan={dashboardRequiredPlan}
          featureName="Dashboard premium"
        />
      </>
    );
  }

  return (
    <DashboardOverview
      name={currentUser?.name?.split(' ')[0] || ''}
      range={timeRange}
      onRangeChange={setTimeRange}
      loading={dashboardAnswersOwnerKey !== dashboardActivityKey}
      summary={accuracySummary}
      timeline={timelineData}
      subjects={topSubjects}
      level={levelProgress}
      streak={studyStreak}
      totals={displayTotals}
      studyLoading={isStudyTimeLoading}
      averageSeconds={averageDailyStudySeconds}
      comments={userCommentsCount}
      motivation={dailyMotivation}
      date={formattedToday}
      insight={accuracyInsight}
    />
  );
};

export default Dashboard;
