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
import { Link } from 'react-router-dom';
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
import { AdPlaceholder } from '../../components/shared/ui/AdPlaceholder';
import {
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
  <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
    <div className={`mb-4 inline-flex rounded-2xl px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${accentClassName}`}>
      {title}
    </div>
    <p className="text-4xl font-black tracking-tight text-slate-900 dark:text-slate-100">{value}</p>
    <p className="mt-2 text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">{subtext}</p>
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
    <div className="relative mx-auto h-44 w-44">
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
              stroke="#0f9baa"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${correctLength} ${circumference - correctLength}`}
            />
            <circle
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke="#ff8a00"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${wrongLength} ${circumference - wrongLength}`}
              strokeDashoffset={-correctLength}
            />
          </>
        )}
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-5xl font-black tracking-tight text-slate-900 dark:text-slate-100">
          {hasData ? `${accuracyRate}%` : '--'}
        </span>
        <span className="mt-1 text-[10px] font-black uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
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
  const [timeRange, setTimeRange] = useState<DashboardTimeRange>('all');
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
    <div className="space-y-8 animate-fade-in">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-indigo-500 dark:text-indigo-400">
            Painel do usuario
          </p>
          <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-slate-100">
            Visao geral dos seus estudos
          </h1>
          <p className="max-w-2xl text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.9fr_0.9fr]">
        <section className="rounded-[2.5rem] border border-fuchsia-200 bg-gradient-to-br from-fuchsia-50 via-white to-indigo-50 p-8 shadow-sm dark:border-fuchsia-900/30 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-fuchsia-100 text-fuchsia-600 dark:bg-fuchsia-500/15 dark:text-fuchsia-300">
                <Lightbulb size={24} />
              </div>
              <div>
                <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100">
                  Motivacao Diaria
                </h2>
                <p className="mt-2 text-lg font-bold text-fuchsia-600 dark:text-fuchsia-300">{formattedToday}</p>
              </div>
            </div>
            <div className="hidden h-16 w-16 rounded-full bg-fuchsia-100/60 md:block dark:bg-fuchsia-500/10" />
          </div>
          <p className="mt-12 text-center text-3xl font-medium italic leading-relaxed text-fuchsia-700 dark:text-fuchsia-200">
            "{dailyMotivation}"
          </p>
        </section>

        <section className="rounded-[2.5rem] border border-orange-300 bg-gradient-to-br from-orange-50 via-white to-amber-50 p-8 shadow-sm dark:border-orange-900/30 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-orange-100 text-orange-500 dark:bg-orange-500/15 dark:text-orange-300">
              <Flame size={24} />
            </div>
            <div>
              <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100">Sequencia de Estudos</h2>
              <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">A contagem reinicia quando um dia inteiro fica sem visita.</p>
            </div>
          </div>

          <div className="mt-10 text-center">
            <p className="text-8xl font-black tracking-tight text-orange-500">{studyStreak.current}</p>
            <p className="mt-2 text-2xl font-bold text-orange-500">
              {studyStreak.current === 1 ? 'dia consecutivo' : 'dias consecutivos'}
            </p>
          </div>

          <div className="mt-10 border-t border-orange-200 pt-5 dark:border-orange-900/30">
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.18em] text-orange-500">
              <span>Melhor marca</span>
              <span>{studyStreak.best} dias</span>
            </div>
          </div>
        </section>

        <section className="rounded-[2.5rem] border border-indigo-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
              <Trophy size={24} />
            </div>
            <div>
              <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100">Nivel do Usuario</h2>
              <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">Progresso atual ate o proximo salto de nivel.</p>
            </div>
          </div>

          <div className="mt-10 flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Nivel atual</p>
              <p className="mt-2 text-7xl font-black tracking-tight text-slate-900 dark:text-slate-100">{levelProgress.currentLevel}</p>
            </div>
            <div className="rounded-2xl bg-indigo-50 px-4 py-3 text-right dark:bg-indigo-500/10">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-500 dark:text-indigo-300">Falta</p>
              <p className="mt-1 text-2xl font-black text-indigo-600 dark:text-indigo-300">{levelProgress.xpToNextLevel} XP</p>
            </div>
          </div>

          <div className="mt-8">
            <div className="mb-3 flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              <span>Progresso do nivel</span>
              <span>{levelProgress.levelProgressPercent}%</span>
            </div>
            <div className="h-4 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-orange-400 transition-all"
                style={{ width: `${levelProgress.levelProgressPercent}%` }}
              />
            </div>
          </div>
        </section>
      </div>

      {systemSettings.adsEnabled && (
        <div className="animate-fade-in">
          <AdPlaceholder type="banner" />
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
        <section className="rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900 xl:col-span-2">
          <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="flex items-center gap-3 text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100">
                <TrendingUp size={24} className="text-indigo-500" />
                Evolucao do Desempenho
              </h2>
              <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                O grafico agora mostra atividade real de questoes respondidas no periodo.
              </p>
            </div>
            <div className="inline-flex rounded-2xl bg-indigo-50 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
              Questoes respondidas
            </div>
          </div>

          <div className="h-[320px] w-full min-w-0 overflow-hidden">
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
                      borderRadius: '18px',
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
                  <Area type="monotone" dataKey="questions" stroke="#4f46e5" fill="url(#questionsFill)" strokeWidth={3} name="questions" />
                  <Area type="monotone" dataKey="correct" stroke="#0ea5a4" fill="url(#correctFill)" strokeWidth={2.4} name="correct" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full flex-col items-center justify-center rounded-[2rem] border border-dashed border-slate-200 bg-slate-50 text-center dark:border-slate-700 dark:bg-slate-950">
                <p className="text-lg font-bold text-slate-700 dark:text-slate-200">Nenhuma questao respondida no periodo.</p>
                <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">Assim que voce resolver questoes, o grafico sera preenchido aqui.</p>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <Target size={20} />
            </div>
            <div>
              <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100">Desempenho Geral</h2>
              <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">Acertos e erros do recorte atual.</p>
            </div>
          </div>

          <CircularPerformanceRing
            accuracyRate={accuracySummary.accuracyRate}
            hasData={accuracySummary.totalQuestions > 0}
          />

          <div className="mt-8 grid grid-cols-3 gap-3 border-t border-slate-100 pt-6 dark:border-slate-800">
            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-center dark:bg-slate-800/70">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Total</p>
              <p className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-100">{accuracySummary.totalQuestions}</p>
            </div>
            <div className="rounded-2xl bg-teal-50 px-4 py-3 text-center dark:bg-teal-500/10">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-teal-600 dark:text-teal-300">Acertos</p>
              <p className="mt-2 text-2xl font-black text-teal-600 dark:text-teal-300">{accuracySummary.correctAnswers}</p>
            </div>
            <div className="rounded-2xl bg-orange-50 px-4 py-3 text-center dark:bg-orange-500/10">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-600 dark:text-orange-300">Erros</p>
              <p className="mt-2 text-2xl font-black text-orange-600 dark:text-orange-300">{accuracySummary.wrongAnswers}</p>
            </div>
          </div>
        </section>

        <section className="rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                <Zap size={20} />
              </div>
              <div>
                <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100">Desempenho por Materia</h2>
                <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">Top materias do periodo atual.</p>
              </div>
            </div>

            <Link
              to="/performance/subjects"
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-600 transition-all hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Ver mais
              <ArrowRight size={14} />
            </Link>
          </div>

          <div className="space-y-4">
            {topSubjects.length > 0 ? topSubjects.map((subject) => (
              <div key={subject.name} className="rounded-[1.6rem] border border-slate-100 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950">
                <div className="mb-3 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-lg font-black text-slate-900 dark:text-slate-100">{subject.name}</p>
                    <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                      {subject.total} questoes respondidas
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white px-4 py-2 text-right shadow-sm dark:bg-slate-900">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Precisao</p>
                    <p className="mt-1 text-2xl font-black text-slate-900 dark:text-slate-100">{subject.accuracy}%</p>
                  </div>
                </div>

                <div className="h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-teal-500 via-indigo-500 to-fuchsia-500"
                    style={{ width: `${subject.accuracy}%` }}
                  />
                </div>

                <div className="mt-4 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.16em]">
                  <span className="rounded-full bg-teal-50 px-3 py-1 text-teal-600 dark:bg-teal-500/10 dark:text-teal-300">
                    {subject.correct} acertos
                  </span>
                  <span className="rounded-full bg-orange-50 px-3 py-1 text-orange-600 dark:bg-orange-500/10 dark:text-orange-300">
                    {subject.wrong} erros
                  </span>
                </div>
              </div>
            )) : (
              <div className="rounded-[2rem] border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center dark:border-slate-700 dark:bg-slate-950">
                <p className="text-lg font-bold text-slate-700 dark:text-slate-200">Sem dados por materia no momento.</p>
                <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
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
