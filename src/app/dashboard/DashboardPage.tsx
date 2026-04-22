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
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowRight,
  Calendar,
  Flame,
  Lightbulb,
  MessageSquare,
  Target,
  TrendingUp,
  Trophy,
  Zap,
} from 'lucide-react';
import { useData } from '@providers/DataProvider';
import { useAuth } from '@providers/AuthProvider';
import { useStudyTracker } from '@providers/StudyTrackerProvider';
import {
  PLATFORM_METRIC_VALUE_CLASS,
  PLATFORM_PAGE_DESCRIPTION_CLASS,
  PLATFORM_SURFACE_CARD_CLASS,
  PLATFORM_PAGE_TITLE_CLASS,
  PLATFORM_SECTION_TITLE_CLASS,
} from '@constants/layout';
import { AdPlaceholder } from '../../components/shared/ui/AdPlaceholder';
import {
  buildAccuracyInsight,
  buildQuestionTimelineData,
  buildSubjectPerformanceData,
  calculateAccuracySummary,
  calculateLevelProgress,
  filterAnswersByRange,
  formatDashboardDate,
  getDailyMotivationForDate,
  type DashboardTimeRange,
} from '@services/dashboard/dashboardInsightsService';
import { getStudyStreakSnapshot, touchStudyStreak, type StudyStreakSnapshot } from '@services/dashboard/studyStreakService';
import { formatStudyDuration } from '@services/statistics/studyTimeFormatting';

const EMPTY_STREAK: StudyStreakSnapshot = {
  current: 0,
  best: 0,
  lastVisitDate: '',
};

/**
 * Card curto de indicador numerico do dashboard.
 * Ele padroniza os boxes pequenos do topo com titulo, valor e contexto.
 *
 * @since 1.0.0
 */
const MetricCard = ({
  title,
  value,
  subtext,
  accentClassName,
}: {
  title: string;
  value: string | number;
  subtext: string;
  accentClassName: string;
}) => (
  <div className={`${PLATFORM_SURFACE_CARD_CLASS} p-5 transition-colors`}>
    <div className={`mb-3 inline-flex rounded-xl px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] ${accentClassName}`}>
      {title}
    </div>
    <p className={PLATFORM_METRIC_VALUE_CLASS}>{value}</p>
    <p className="mt-1.5 text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">{subtext}</p>
  </div>
);

/**
 * Donut customizado do card de desempenho geral.
 * Ele segue a linguagem do exemplo enviado e destaca acertos e erros no mesmo anel.
 *
 * @since 1.0.0
 */
const CircularPerformanceRing = ({
  accuracyRate,
  hasData,
}: {
  accuracyRate: number;
  hasData: boolean;
}) => {
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const correctLength = circumference * (accuracyRate / 100);
  const wrongLength = hasData ? Math.max(0, circumference - correctLength) : 0;

  return (
    <div className="relative mx-auto h-36 w-36">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 140 140">
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="10"
          className="text-slate-200 dark:text-slate-800"
        />
        {hasData && (
          <>
            <circle
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke="#16a34a"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${correctLength} ${circumference - correctLength}`}
            />
            <circle
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke="#dc2626"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${wrongLength} ${circumference - wrongLength}`}
              strokeDashoffset={-correctLength}
            />
          </>
        )}
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100">
          {hasData ? `${accuracyRate}%` : '--'}
        </span>
        <span className="mt-1 text-[9px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
          Precisao
        </span>
      </div>
    </div>
  );
};

/**
 * Dashboard principal do usuario autenticado.
 * Ele resume atividade, motivacao, sequencia, nivel e desempenho por materia em um unico painel.
 *
 * @since 1.0.0
 */
const Dashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const { userAnswers, questions, userComments, systemSettings, ensureUserProgressLoaded } = useData();
  const { displayTotals, isLoading: isStudyTimeLoading } = useStudyTracker();
  const [timeRange, setTimeRange] = useState<DashboardTimeRange>('all');
  const [showCorrectTimeline, setShowCorrectTimeline] = useState<boolean>(true);
  const [dailyMotivationMarkdown, setDailyMotivationMarkdown] = useState<string>(systemSettings.dailyMotivationMarkdown || '');
  const [studyStreak, setStudyStreak] = useState<StudyStreakSnapshot>(() => (
    currentUser?.id ? getStudyStreakSnapshot(currentUser.id) : EMPTY_STREAK
  ));

  /**
   * Garante que as respostas do usuario estejam carregadas antes dos calculos.
   *
   * @since 1.0.0
   */
  React.useEffect(() => {
    ensureUserProgressLoaded();
  }, [ensureUserProgressLoaded]);

  /**
   * Atualiza a base de motivacoes conforme o admin salva um markdown novo.
   * Na ausencia de configuracao, carrega o arquivo padrao com 365 frases.
   *
   * @since 1.0.0
   */
  React.useEffect(() => {
    const configuredMarkdown = systemSettings.dailyMotivationMarkdown || '';
    if (configuredMarkdown.trim() !== '') {
      setDailyMotivationMarkdown(configuredMarkdown);
      return;
    }

    let isMounted = true;
    fetch('/content/motivacoes-diarias.md')
      .then((response) => response.text())
      .then((markdown) => {
        if (isMounted) {
          setDailyMotivationMarkdown(markdown);
        }
      })
      .catch(() => {
        if (isMounted) {
          setDailyMotivationMarkdown('');
        }
      });

    return () => {
      isMounted = false;
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
      setStudyStreak(EMPTY_STREAK);
      return;
    }

    setStudyStreak(touchStudyStreak(currentUser.id));
  }, [currentUser?.id]);

  const filteredAnswers = useMemo(
    () => filterAnswersByRange(userAnswers, timeRange),
    [userAnswers, timeRange],
  );

  const accuracySummary = useMemo(
    () => calculateAccuracySummary(filteredAnswers),
    [filteredAnswers],
  );

  const subjectMetrics = useMemo(
    () => buildSubjectPerformanceData(filteredAnswers, questions),
    [filteredAnswers, questions],
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
    if (!currentUser) {
      return 0;
    }

    if (timeRange === 'all') {
      return currentUser.commentsCount || 0;
    }

    const startTimestamp = timelineData[0]?.timestamp || 0;
    return (userComments || []).filter((comment) => new Date(comment.date).getTime() >= startTimestamp).length;
  }, [currentUser, timeRange, timelineData, userComments]);

  const topSubjects = subjectMetrics.slice(0, 5);
  const dailyMotivation = useMemo(
    () => getDailyMotivationForDate(dailyMotivationMarkdown, new Date()),
    [dailyMotivationMarkdown],
  );
  const formattedToday = useMemo(() => formatDashboardDate(new Date()), []);

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-indigo-500 dark:text-indigo-400">
            Painel do usuario
          </p>
          <h1 className={PLATFORM_PAGE_TITLE_CLASS}>
            Visao geral dos seus estudos
          </h1>
          <p className={PLATFORM_PAGE_DESCRIPTION_CLASS}>
            Atividade real, motivacao diaria e um retrato claro do que voce ja construiu.
          </p>
        </div>

        <div className="flex max-w-full gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm no-scrollbar dark:border-slate-800 dark:bg-slate-900">
          {[
            { id: 'today', label: 'Hoje' },
            { id: 'week', label: 'Semana' },
            { id: 'month', label: 'Mes' },
            { id: 'year', label: 'Ano' },
            { id: 'all', label: 'Tudo' },
          ].map((range) => (
            <button
              key={range.id}
              type="button"
              onClick={() => setTimeRange(range.id as DashboardTimeRange)}
              className={`rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] transition-all ${
                timeRange === range.id
                  ? 'bg-slate-900 text-white shadow-sm dark:bg-indigo-600'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </header>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Taxa de acerto"
          value={`${accuracySummary.accuracyRate}%`}
          subtext="Media real do periodo selecionado."
          accentClassName="bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300"
        />
        <MetricCard
          title="Questoes feitas"
          value={accuracySummary.totalQuestions}
          subtext="Total de respostas registradas no recorte atual."
          accentClassName="bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300"
        />
        <MetricCard
          title="Comentarios"
          value={userCommentsCount}
          subtext="Participacao ativa nas questoes e na comunidade."
          accentClassName="bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300"
        />
        <MetricCard
          title="Nivel atual"
          value={levelProgress.currentLevel}
          subtext={`${levelProgress.currentXp} XP acumulados ate agora.`}
          accentClassName="bg-fuchsia-50 text-fuchsia-600 dark:bg-fuchsia-500/10 dark:text-fuchsia-300"
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-3 xl:grid-cols-[1.25fr_0.9fr_1fr]">
        <section className="rounded-[2rem] border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-violet-100 p-5 shadow-sm dark:border-indigo-900/40 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/70">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700 shadow-sm dark:bg-indigo-500/20 dark:text-indigo-200">
              <Lightbulb size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <h2 className={`${PLATFORM_SECTION_TITLE_CLASS} text-slate-600 dark:text-slate-400`}>
                  Motivacao Diaria
                </h2>
                <p className="text-[11px] font-bold text-indigo-700 dark:text-indigo-200">{formattedToday}</p>
              </div>
              <p className="mt-1 text-xs font-medium leading-5 text-indigo-700/80 dark:text-indigo-200/80">
                Uma frase curta para iniciar o dia.
              </p>
            </div>
          </div>

          <p className="mt-5 text-center text-lg font-medium italic leading-7 text-indigo-900 dark:text-indigo-100">
            "{dailyMotivation}"
          </p>
        </section>

        <section className={`${PLATFORM_SURFACE_CARD_CLASS} p-5`}>
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300">
              <Flame size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className={`${PLATFORM_SECTION_TITLE_CLASS} text-slate-600 dark:text-slate-400`}>Sequencia de Estudos</h2>
              <p className="mt-1 text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">Zera quando um dia fica sem visita.</p>
            </div>
          </div>

          <div className="mt-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-5xl font-black tracking-tight text-slate-900 dark:text-slate-100">{studyStreak.current}</p>
              <p className="mt-1 text-sm font-bold text-amber-600 dark:text-amber-300">
              {studyStreak.current === 1 ? 'dia consecutivo' : 'dias consecutivos'}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2 text-right dark:bg-slate-800">
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">Melhor marca</p>
              <p className="mt-1 text-lg font-black text-slate-900 dark:text-slate-100">{studyStreak.best}d</p>
            </div>
          </div>
        </section>

        <section className={`${PLATFORM_SURFACE_CARD_CLASS} p-5`}>
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300">
              <Calendar size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <h2 className={`${PLATFORM_SECTION_TITLE_CLASS} text-slate-600 dark:text-slate-400`}>Tempo de Estudos</h2>
                <span className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                  {isStudyTimeLoading ? 'Sincronizando' : 'Ao vivo'}
                </span>
              </div>
              <p className="mt-1 text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">
                Leitura, questoes e total acumulado com a sessao atual.
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="rounded-2xl bg-slate-50 px-3 py-3 dark:bg-slate-800/70">
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">Leitura</p>
              <p className="mt-1 text-lg font-black text-slate-900 dark:text-slate-100">{formatStudyDuration(displayTotals.readingSeconds)}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 px-3 py-3 dark:bg-slate-800/70">
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">Questoes</p>
              <p className="mt-1 text-lg font-black text-slate-900 dark:text-slate-100">{formatStudyDuration(displayTotals.questionSeconds)}</p>
            </div>
            <div className="rounded-2xl bg-indigo-50 px-3 py-3 dark:bg-indigo-500/10">
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-indigo-500 dark:text-indigo-300">Total</p>
              <p className="mt-1 text-lg font-black text-slate-900 dark:text-slate-100">{formatStudyDuration(displayTotals.totalSeconds)}</p>
            </div>
          </div>
        </section>
      </div>

      {systemSettings.adsEnabled && (
        <div className="animate-fade-in">
          <AdPlaceholder type="banner" />
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.45fr_0.95fr]">
        <section className={`${PLATFORM_SURFACE_CARD_CLASS} p-6 xl:col-span-2`}>
          <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className={`flex items-center gap-3 ${PLATFORM_SECTION_TITLE_CLASS}`}>
                <TrendingUp size={18} className="text-indigo-500" />
                Evolucao do Desempenho
              </h2>
              <p className="mt-1 text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">
                O grafico agora mostra atividade real de questoes respondidas no periodo.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCorrectTimeline((currentValue) => !currentValue)}
                className={`inline-flex items-center rounded-xl border px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.16em] transition-colors ${
                  showCorrectTimeline
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
                    : 'border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400'
                }`}
              >
                {showCorrectTimeline ? 'Ocultar acertos' : 'Mostrar acertos'}
              </button>
              <div className="inline-flex rounded-xl bg-indigo-50 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.16em] text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
                Questoes respondidas
              </div>
            </div>
          </div>

          <div className="h-[280px] w-full min-w-0 overflow-hidden">
            {accuracySummary.totalQuestions > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timelineData} margin={{ top: 12, right: 12, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="questionsFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="correctFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5a4" stopOpacity={0.24} />
                      <stop offset="95%" stopColor="#0ea5a4" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="#e2e8f0" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '14px',
                      border: '1px solid rgba(148,163,184,0.25)',
                      backgroundColor: 'rgba(15,23,42,0.96)',
                      color: '#fff',
                    }}
                    formatter={(value: number, name: string) => [
                      `${value}`,
                      name === 'questions' ? 'Questoes' : 'Acertos',
                    ]}
                    labelFormatter={(label) => `Periodo: ${label}`}
                  />
                  <Area type="linear" dataKey="questions" stroke="#4f46e5" fill="url(#questionsFill)" strokeWidth={2.5} name="questions" />
                  {showCorrectTimeline ? (
                    <Area type="linear" dataKey="correct" stroke="#0ea5a4" fill="url(#correctFill)" strokeWidth={2} name="correct" />
                  ) : null}
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full flex-col items-center justify-center rounded-[2rem] border border-dashed border-slate-200 bg-slate-50 text-center dark:border-slate-700 dark:bg-slate-950">
                <p className="text-base font-bold text-slate-700 dark:text-slate-200">Nenhuma questao respondida no periodo.</p>
                <p className="mt-2 text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">Assim que voce resolver questoes, o grafico sera preenchido aqui.</p>
              </div>
            )}
          </div>
        </section>

        <section className={`${PLATFORM_SURFACE_CARD_CLASS} p-6`}>
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
              <Target size={16} />
            </div>
            <div>
              <h2 className={PLATFORM_SECTION_TITLE_CLASS}>Desempenho Geral</h2>
              <p className="mt-1 text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">Acertos, erros e nivel atual.</p>
            </div>
          </div>

          <CircularPerformanceRing
            accuracyRate={accuracySummary.accuracyRate}
            hasData={accuracySummary.totalQuestions > 0}
          />

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-2 border-t border-slate-100 pt-5 dark:border-slate-800">
            <div className="rounded-xl bg-slate-50 px-3 py-2.5 text-center dark:bg-slate-800/70">
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">Total</p>
              <p className="mt-1 text-lg font-black text-slate-900 dark:text-slate-100">{accuracySummary.totalQuestions}</p>
            </div>
            <div className="rounded-xl bg-emerald-50 px-3 py-2.5 text-center dark:bg-emerald-500/10">
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-300">Acertos</p>
              <p className="mt-1 text-lg font-black text-emerald-600 dark:text-emerald-300">{accuracySummary.correctAnswers}</p>
            </div>
            <div className="rounded-xl bg-amber-50 px-3 py-2.5 text-center dark:bg-amber-500/10">
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-amber-600 dark:text-amber-300">Erros</p>
              <p className="mt-1 text-lg font-black text-amber-600 dark:text-amber-300">{accuracySummary.wrongAnswers}</p>
            </div>
          </div>

          <div
            className={`mt-4 rounded-2xl border p-4 ${
              accuracyInsight.tone === 'emerald'
                ? 'border-emerald-200 bg-emerald-50/80 dark:border-emerald-500/20 dark:bg-emerald-500/10'
                : accuracyInsight.tone === 'amber'
                  ? 'border-amber-200 bg-amber-50/80 dark:border-amber-500/20 dark:bg-amber-500/10'
                  : accuracyInsight.tone === 'rose'
                    ? 'border-rose-200 bg-rose-50/80 dark:border-rose-500/20 dark:bg-rose-500/10'
                    : 'border-indigo-200 bg-indigo-50/80 dark:border-indigo-500/20 dark:bg-indigo-500/10'
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                  accuracyInsight.tone === 'emerald'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                    : accuracyInsight.tone === 'amber'
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
                      : accuracyInsight.tone === 'rose'
                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300'
                        : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300'
                }`}
              >
                <Lightbulb size={16} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Insight do periodo</p>
                <p className="mt-1 text-sm font-black text-slate-900 dark:text-slate-100">{accuracyInsight.title}</p>
                <p className="mt-1 text-xs font-medium leading-5 text-slate-600 dark:text-slate-300">{accuracyInsight.description}</p>
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Trophy size={14} className="text-indigo-500" />
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Nivel do usuario</p>
              </div>
              <span className="text-sm font-black text-slate-900 dark:text-slate-100">Nivel {levelProgress.currentLevel}</span>
            </div>

            <div className="mb-2 flex items-center justify-between text-[11px] font-medium text-slate-500 dark:text-slate-400">
              <span>{levelProgress.currentXp} XP</span>
              <span>Faltam {levelProgress.xpToNextLevel} XP</span>
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-400 transition-all"
                style={{ width: `${levelProgress.levelProgressPercent}%` }}
              />
            </div>
          </div>
        </section>

        <section className={`${PLATFORM_SURFACE_CARD_CLASS} p-6`}>
          <div className="mb-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
                <Zap size={16} />
              </div>
              <div>
                <h2 className={PLATFORM_SECTION_TITLE_CLASS}>Desempenho por Materia</h2>
                <p className="mt-1 text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">Top materias do periodo atual.</p>
              </div>
            </div>

            <Link
              href="/performance/subjects"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.16em] text-slate-600 transition-all hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Ver mais
              <ArrowRight size={14} />
            </Link>
          </div>

          <div className="space-y-3">
            {topSubjects.length > 0 ? topSubjects.map((subject) => (
              <div key={subject.name} className="rounded-[1.4rem] border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                <div className="mb-2.5 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-base font-black text-slate-900 dark:text-slate-100">{subject.name}</p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                      {subject.total} questoes respondidas
                    </p>
                  </div>
                  <div className="rounded-xl bg-white px-3 py-2 text-right shadow-sm dark:bg-slate-900">
                    <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">Precisao</p>
                    <p className="mt-1 text-lg font-black text-slate-900 dark:text-slate-100">{subject.accuracy}%</p>
                  </div>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-400"
                    style={{ width: `${subject.accuracy}%` }}
                  />
                </div>

                <div className="mt-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em]">
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
                    {subject.correct} acertos
                  </span>
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300">
                    {subject.wrong} erros
                  </span>
                </div>
              </div>
            )) : (
              <div className="rounded-[2rem] border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center dark:border-slate-700 dark:bg-slate-950">
                <p className="text-base font-bold text-slate-700 dark:text-slate-200">Sem dados por materia no momento.</p>
                <p className="mt-2 text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">
                  Assim que voce responder questoes, o ranking por materia aparecera aqui.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default Dashboard;
