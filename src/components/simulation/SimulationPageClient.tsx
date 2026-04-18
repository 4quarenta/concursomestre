'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  CheckCircle2,
  Clock,
  Filter,
  Loader2,
  PlayCircle,
  RotateCcw,
  Search,
  Trophy,
} from 'lucide-react';
import { useAuthSession } from '@/components/auth/AuthSessionProvider';
import QuestionAttemptCard from '@/components/questions/QuestionAttemptCard';
import FeaturePlaceholderPage from '@/components/shared/FeaturePlaceholderPage';
import { readApiErrorMessage } from '@/lib/browserApi';
import { questionService } from '@/services/questions';
import type { Question, SimulationConfig, SimulationSession, Subject, SystemSettings, UserAnswer } from '@/types';

type SimulationPageClientProps = {
  systemSettings: SystemSettings;
};

type SimulationSetup = {
  agency: string;
  difficulty: string;
  feedbackMode: 'after_all' | 'instant';
  name: string;
  questionCount: number;
  subject: string;
  timerEnabled: boolean;
  timerMinutes: number;
  topic: string;
  year: string;
};

type Notice = {
  text: string;
  type: 'error' | 'success' | 'warning';
};

const DEFAULT_SETUP: SimulationSetup = {
  agency: 'All',
  difficulty: 'All',
  feedbackMode: 'after_all',
  name: 'Treino de Performance',
  questionCount: 10,
  subject: 'All',
  timerEnabled: true,
  timerMinutes: 20,
  topic: 'All',
  year: 'All',
};

const QUESTION_POOL_LIMIT = 160;

const DIFFICULTY_OPTIONS = [
  { label: 'Muito facil', value: '1' },
  { label: 'Facil', value: '2' },
  { label: 'Medio', value: '3' },
  { label: 'Dificil', value: '4' },
  { label: 'Muito dificil', value: '5' },
];

const uniqueSorted = (items: Array<string | number | null | undefined>) => (
  Array.from(new Set(items.map((item) => String(item || '').trim()).filter(Boolean)))
    .sort((left, right) => left.localeCompare(right, 'pt-BR'))
);

const getQuestionSubject = (question: Question) => (
  question.assuntos?.find((item) => item.materia)?.nome
  || question.assuntos?.[0]?.nome
  || ''
);

const getQuestionTopics = (question: Question) => (
  question.assuntos?.filter((item) => !item.materia).map((item) => item.nome) || []
);

const shuffleQuestions = (questions: Question[]) => {
  const nextQuestions = [...questions];

  for (let index = nextQuestions.length - 1; index > 0; index -= 1) {
    const targetIndex = Math.floor(Math.random() * (index + 1));
    [nextQuestions[index], nextQuestions[targetIndex]] = [nextQuestions[targetIndex], nextQuestions[index]];
  }

  return nextQuestions;
};

const secondsToLabel = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const rest = safeSeconds % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
};

const buildSimulationConfig = (setup: SimulationSetup): SimulationConfig => ({
  id: '',
  name: setup.name.trim() || DEFAULT_SETUP.name,
  questionCount: setup.questionCount,
  subjects: setup.subject === 'All' ? [] : [setup.subject as Subject],
  difficulty: setup.difficulty === 'All' ? 'All' : setup.difficulty as any,
  timerEnabled: setup.timerEnabled,
  timerMinutes: setup.timerMinutes,
  feedbackMode: setup.feedbackMode,
  filters: {
    careers: [],
    agencies: setup.agency === 'All' ? [] : [setup.agency],
    years: setup.year === 'All' ? [] : [setup.year],
    organizations: [],
    roles: [],
    levels: [],
    topics: setup.topic === 'All' ? [] : [setup.topic],
  },
});

const buildSessionAnswers = (answers: Record<string, UserAnswer>) => (
  Object.fromEntries(
    Object.entries(answers).map(([questionId, answer]) => [
      questionId,
      {
        index: answer.selectedOptionIndex,
        is_correct: answer.isCorrect,
        time_taken: answer.timeTaken || 0,
      },
    ]),
  ) as unknown as SimulationSession['answers']
);

function SelectField({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: string[];
  value: string;
}) {
  return (
    <label className="space-y-2">
      <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none transition focus:border-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      >
        <option value="All">Todos</option>
        {options.map((option) => (
          <option key={`${label}-${option}`} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function SimulationPageClient({ systemSettings }: SimulationPageClientProps) {
  const { currentUser, isLoading: isAuthLoading, refreshUser } = useAuthSession();
  const [setup, setSetup] = useState<SimulationSetup>(DEFAULT_SETUP);
  const [questionPool, setQuestionPool] = useState<Question[]>([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(true);
  const [activeSession, setActiveSession] = useState<SimulationSession | null>(null);
  const [completedSession, setCompletedSession] = useState<SimulationSession | null>(null);
  const [answersByQuestionId, setAnswersByQuestionId] = useState<Record<string, UserAnswer>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [step, setStep] = useState<'config' | 'active' | 'result'>('config');
  const [notice, setNotice] = useState<Notice | null>(null);
  const [savingQuestionId, setSavingQuestionId] = useState<string | null>(null);
  const [isSavingSimulation, setIsSavingSimulation] = useState(false);

  const featureEnabled = systemSettings.features.simulationsEnabled !== false;

  useEffect(() => {
    if (!featureEnabled) {
      return;
    }

    let cancelled = false;

    const loadQuestionPool = async () => {
      setIsLoadingQuestions(true);

      try {
        const result = await questionService.getQuestionPage({
          page: 1,
          limit: QUESTION_POOL_LIMIT,
        });

        if (!cancelled) {
          setQuestionPool(result.rows);
        }
      } catch (error) {
        if (!cancelled) {
          setNotice({
            type: 'error',
            text: readApiErrorMessage(error, 'Nao foi possivel carregar o banco de questoes para simulados.'),
          });
          setQuestionPool([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingQuestions(false);
        }
      }
    };

    void loadQuestionPool();

    return () => {
      cancelled = true;
    };
  }, [featureEnabled]);

  const subjectOptions = useMemo(() => {
    if (systemSettings.taxonomies?.subjects?.length) {
      return uniqueSorted(systemSettings.taxonomies.subjects.map((item) => item.name));
    }

    return uniqueSorted(questionPool.map(getQuestionSubject));
  }, [questionPool, systemSettings.taxonomies?.subjects]);

  const topicOptions = useMemo(() => {
    if (systemSettings.taxonomies?.topics?.length) {
      return uniqueSorted(systemSettings.taxonomies.topics.map((item) => item.name));
    }

    return uniqueSorted(questionPool.flatMap(getQuestionTopics));
  }, [questionPool, systemSettings.taxonomies?.topics]);

  const agencyOptions = useMemo(() => {
    if (systemSettings.taxonomies?.agencies?.length) {
      return uniqueSorted(systemSettings.taxonomies.agencies.map((item) => item.name || item.slug));
    }

    return uniqueSorted(questionPool.flatMap((question) => question.bancas?.map((item) => item.sigla || item.nome) || []));
  }, [questionPool, systemSettings.taxonomies?.agencies]);

  const yearOptions = useMemo(() => {
    if (systemSettings.taxonomies?.years?.length) {
      return uniqueSorted(systemSettings.taxonomies.years).sort((left, right) => right.localeCompare(left, 'pt-BR'));
    }

    return uniqueSorted(questionPool.flatMap((question) => question.anos || []))
      .sort((left, right) => right.localeCompare(left, 'pt-BR'));
  }, [questionPool, systemSettings.taxonomies?.years]);

  const filteredPool = useMemo(() => (
    questionPool.filter((question) => {
      const matchesSubject = setup.subject === 'All'
        || question.assuntos?.some((item) => item.nome === setup.subject);
      const matchesTopic = setup.topic === 'All'
        || question.assuntos?.some((item) => item.nome === setup.topic);
      const matchesAgency = setup.agency === 'All'
        || question.bancas?.some((item) => item.sigla === setup.agency || item.nome === setup.agency);
      const matchesYear = setup.year === 'All'
        || question.anos?.some((year) => String(year) === setup.year);
      const matchesDifficulty = setup.difficulty === 'All'
        || String(question.dificuldade) === setup.difficulty;

      return matchesSubject && matchesTopic && matchesAgency && matchesYear && matchesDifficulty;
    })
  ), [questionPool, setup]);

  const finishSimulation = useCallback(async () => {
    if (!activeSession || step !== 'active') {
      return;
    }

    const score = activeSession.questions.filter((question) => answersByQuestionId[String(question.id)]?.isCorrect).length;
    const completed: SimulationSession = {
      ...activeSession,
      answers: buildSessionAnswers(answersByQuestionId),
      endTime: Date.now(),
      score,
      status: 'completed',
    };

    setActiveSession(completed);
    setCompletedSession(completed);
    setStep('result');
    setIsSavingSimulation(true);
    setNotice(null);

    try {
      if (currentUser) {
        await questionService.saveSimulation(completed);
        await refreshUser();
      }
    } catch (error) {
      setNotice({
        type: 'warning',
        text: readApiErrorMessage(error, 'Simulado concluido localmente, mas nao foi possivel salvar a sessao completa.'),
      });
    } finally {
      setIsSavingSimulation(false);
    }
  }, [activeSession, answersByQuestionId, currentUser, refreshUser, step]);

  useEffect(() => {
    if (step !== 'active' || !activeSession?.config.timerEnabled) {
      return;
    }

    if (timeLeft <= 0) {
      void finishSimulation();
      return;
    }

    const timer = window.setTimeout(() => {
      setTimeLeft((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [activeSession?.config.timerEnabled, finishSimulation, step, timeLeft]);

  const startSimulation = () => {
    if (!currentUser) {
      setNotice({ type: 'warning', text: 'Entre para iniciar simulados e salvar seu desempenho.' });
      return;
    }

    if (!currentUser.emailVerified) {
      setNotice({ type: 'warning', text: 'Confirme seu e-mail antes de iniciar simulados.' });
      return;
    }

    if (filteredPool.length === 0) {
      setNotice({ type: 'warning', text: 'Nenhuma questao encontrada para este recorte.' });
      return;
    }

    const selectedQuestions = shuffleQuestions(filteredPool).slice(0, setup.questionCount);
    const config = buildSimulationConfig(setup);
    const session: SimulationSession = {
      id: `sim-${Date.now()}`,
      config,
      questions: selectedQuestions,
      answers: {},
      startTime: Date.now(),
      status: 'in_progress',
    };

    setActiveSession(session);
    setCompletedSession(null);
    setAnswersByQuestionId({});
    setCurrentQuestionIndex(0);
    setTimeLeft(setup.timerEnabled ? setup.timerMinutes * 60 : 0);
    setStep('active');
    setNotice(null);
  };

  const handleAnswerSubmit = async (answer: UserAnswer) => {
    if (!currentUser || !activeSession) {
      setNotice({ type: 'warning', text: 'Entre para registrar respostas do simulado.' });
      return;
    }

    const answerWithSession = {
      ...answer,
      simulationId: activeSession.id,
    };

    setAnswersByQuestionId((current) => ({
      ...current,
      [String(answer.questionId)]: answerWithSession,
    }));
    setSavingQuestionId(String(answer.questionId));
    setNotice(null);

    try {
      await questionService.submitUserAnswer(currentUser.id, answerWithSession);
    } catch (error) {
      setNotice({
        type: 'warning',
        text: readApiErrorMessage(error, 'Resposta mantida no simulado, mas nao foi possivel salvar no historico agora.'),
      });
    } finally {
      setSavingQuestionId(null);
    }
  };

  const resetSimulation = () => {
    setActiveSession(null);
    setCompletedSession(null);
    setAnswersByQuestionId({});
    setCurrentQuestionIndex(0);
    setTimeLeft(0);
    setStep('config');
    setNotice(null);
  };

  if (!featureEnabled) {
    return (
      <FeaturePlaceholderPage
        title="Simulados"
        description="Modulo reservado para simulados com filtros, cronometro e resultado."
        icon={Trophy}
        isEnabled={false}
        featureLabel="Simulados"
        backHref="/"
      />
    );
  }

  const activeQuestion = activeSession?.questions[currentQuestionIndex];
  const answeredCount = Object.keys(answersByQuestionId).length;
  const resultSession = completedSession || (step === 'result' ? activeSession : null);
  const resultScore = resultSession?.score || 0;
  const resultTotal = resultSession?.questions.length || 0;
  const accuracy = resultTotal > 0 ? Math.round((resultScore / resultTotal) * 100) : 0;

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 text-slate-900 dark:text-slate-100 sm:px-6 lg:px-8">
      <header className="grid gap-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-sky-700 dark:text-sky-300">
            Simulado
          </p>
          <h1 className="text-3xl font-black tracking-tight md:text-5xl">
            Monte um treino cronometrado a partir do banco real.
          </h1>
          <p className="max-w-3xl text-sm font-medium leading-7 text-slate-500 dark:text-slate-400">
            Defina quantidade, recorte de conteudo, modo de feedback e cronometro. Ao finalizar, o resultado fica conectado ao seu progresso.
          </p>
        </div>

        <aside className="rounded-lg border border-sky-200 bg-sky-50 p-4 dark:border-sky-900/40 dark:bg-sky-950/20">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-800 dark:text-sky-200">
            Banco carregado
          </p>
          <p className="mt-2 text-3xl font-black">{filteredPool.length}</p>
          <p className="mt-1 text-xs font-bold text-slate-600 dark:text-slate-300">
            questoes disponiveis para o recorte atual
          </p>
          {!currentUser && !isAuthLoading ? (
            <Link
              href="/auth?next=%2Fsimulation"
              className="mt-4 inline-flex items-center justify-center rounded-lg bg-sky-700 px-4 py-2.5 text-xs font-black uppercase tracking-[0.16em] text-white transition hover:bg-sky-800"
            >
              Entrar
            </Link>
          ) : null}
        </aside>
      </header>

      {notice ? (
        <div className={`rounded-lg border px-4 py-3 text-sm font-bold ${
          notice.type === 'success'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-200'
            : notice.type === 'warning'
              ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200'
              : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-200'
        }`}>
          {notice.text}
        </div>
      ) : null}

      {step === 'config' ? (
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2">
              <Filter className="text-sky-700 dark:text-sky-300" size={18} />
              <h2 className="text-xl font-black">Configuracao</h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 md:col-span-2">
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Nome do simulado
                </span>
                <input
                  value={setup.name}
                  onChange={(event) => setSetup((current) => ({ ...current, name: event.target.value }))}
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none transition focus:border-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </label>

              <label className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Quantidade
                </span>
                <input
                  type="number"
                  min={5}
                  max={Math.max(5, Math.min(100, filteredPool.length || 100))}
                  value={setup.questionCount}
                  onChange={(event) => setSetup((current) => ({
                    ...current,
                    questionCount: Math.max(5, Math.min(100, Number(event.target.value) || 5)),
                  }))}
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none transition focus:border-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </label>

              <label className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Tempo em minutos
                </span>
                <input
                  type="number"
                  min={5}
                  max={240}
                  value={setup.timerMinutes}
                  onChange={(event) => setSetup((current) => ({
                    ...current,
                    timerMinutes: Math.max(5, Math.min(240, Number(event.target.value) || 5)),
                  }))}
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none transition focus:border-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </label>

              <SelectField
                label="Materia"
                value={setup.subject}
                options={subjectOptions}
                onChange={(value) => setSetup((current) => ({ ...current, subject: value, topic: 'All' }))}
              />
              <SelectField
                label="Assunto"
                value={setup.topic}
                options={topicOptions}
                onChange={(value) => setSetup((current) => ({ ...current, topic: value }))}
              />
              <SelectField
                label="Banca"
                value={setup.agency}
                options={agencyOptions}
                onChange={(value) => setSetup((current) => ({ ...current, agency: value }))}
              />
              <SelectField
                label="Ano"
                value={setup.year}
                options={yearOptions}
                onChange={(value) => setSetup((current) => ({ ...current, year: value }))}
              />

              <label className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Dificuldade
                </span>
                <select
                  value={setup.difficulty}
                  onChange={(event) => setSetup((current) => ({ ...current, difficulty: event.target.value }))}
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none transition focus:border-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="All">Todas</option>
                  {DIFFICULTY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Feedback
                </span>
                <select
                  value={setup.feedbackMode}
                  onChange={(event) => setSetup((current) => ({
                    ...current,
                    feedbackMode: event.target.value as SimulationSetup['feedbackMode'],
                  }))}
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none transition focus:border-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="after_all">Depois de entregar</option>
                  <option value="instant">Imediato</option>
                </select>
              </label>
            </div>

            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-slate-600 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-300">
              <input
                type="checkbox"
                checked={setup.timerEnabled}
                onChange={(event) => setSetup((current) => ({ ...current, timerEnabled: event.target.checked }))}
                className="h-4 w-4 accent-sky-700"
              />
              Cronometro ativo
            </label>
          </div>

          <aside className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
              {isLoadingQuestions ? <Loader2 className="animate-spin" size={22} /> : <Trophy size={22} />}
            </div>
            <h2 className="text-xl font-black">Pronto para iniciar</h2>
            <p className="text-sm font-medium leading-7 text-slate-500 dark:text-slate-400">
              O sistema vai embaralhar o recorte atual e montar uma sessao com {setup.questionCount} questoes.
            </p>
            <button
              type="button"
              onClick={startSimulation}
              disabled={isLoadingQuestions || isAuthLoading || filteredPool.length === 0}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-sky-700 px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-white transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoadingQuestions || isAuthLoading ? <Loader2 className="animate-spin" size={15} /> : <PlayCircle size={15} />}
              Iniciar simulado
            </button>
          </aside>
        </section>
      ) : null}

      {step === 'active' && activeSession && activeQuestion ? (
        <section className="space-y-5">
          <div className="sticky top-3 z-30 rounded-lg border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-lg bg-sky-50 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-sky-800 dark:bg-sky-950/30 dark:text-sky-200">
                  <BarChart3 size={14} />
                  {answeredCount}/{activeSession.questions.length}
                </span>
                {activeSession.config.timerEnabled ? (
                  <span className="inline-flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                    <Clock size={14} />
                    {secondsToLabel(timeLeft)}
                  </span>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentQuestionIndex((current) => Math.max(0, current - 1))}
                  disabled={currentQuestionIndex === 0}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (currentQuestionIndex === activeSession.questions.length - 1) {
                      void finishSimulation();
                      return;
                    }

                    setCurrentQuestionIndex((current) => Math.min(activeSession.questions.length - 1, current + 1));
                  }}
                  className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-white transition hover:bg-slate-800 dark:bg-sky-700 dark:hover:bg-sky-800"
                >
                  {currentQuestionIndex === activeSession.questions.length - 1 ? 'Entregar' : 'Proxima'}
                </button>
              </div>
            </div>
          </div>

          <QuestionAttemptCard
            question={activeQuestion}
            indexDisplay={currentQuestionIndex + 1}
            answer={answersByQuestionId[String(activeQuestion.id)]}
            canAnswer={Boolean(currentUser?.emailVerified)}
            hideFeedback={activeSession.config.feedbackMode === 'after_all'}
            isSaving={savingQuestionId === String(activeQuestion.id)}
            mode="simulation"
            lockedMessage="Sessao autenticada e e-mail confirmado sao obrigatorios para registrar o simulado."
            onAuthRequired={() => setNotice({ type: 'warning', text: 'Entre e confirme seu e-mail para responder.' })}
            onAnswerSubmit={handleAnswerSubmit}
          />

          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => finishSimulation()}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <CheckCircle2 size={15} />
              Finalizar agora
            </button>
          </div>
        </section>
      ) : null}

      {step === 'result' && resultSession ? (
        <section className="space-y-6">
          <div className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:grid-cols-[260px_1fr]">
            <div className="flex flex-col items-center justify-center rounded-lg border border-sky-200 bg-sky-50 p-6 text-center dark:border-sky-900/40 dark:bg-sky-950/20">
              <Trophy className="text-sky-700 dark:text-sky-300" size={34} />
              <p className="mt-4 text-5xl font-black">{accuracy}%</p>
              <p className="mt-2 text-xs font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                aproveitamento
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-sky-700 dark:text-sky-300">
                  Resultado
                </p>
                <h2 className="mt-2 text-3xl font-black">{resultSession.config.name}</h2>
                <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                  {resultScore} acertos em {resultTotal} questoes.
                </p>
              </div>
              {isSavingSimulation ? (
                <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400">
                  <Loader2 className="animate-spin" size={14} />
                  Salvando simulado...
                </div>
              ) : null}
              <button
                type="button"
                onClick={resetSimulation}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-white transition hover:bg-slate-800 dark:bg-sky-700 dark:hover:bg-sky-800"
              >
                <RotateCcw size={15} />
                Novo simulado
              </button>
            </div>
          </div>

          <div className="space-y-5">
            {resultSession.questions.map((question, index) => (
              <QuestionAttemptCard
                key={`${question.id}-${index}`}
                question={question}
                indexDisplay={index + 1}
                answer={answersByQuestionId[String(question.id)]}
                canAnswer={false}
                hideFeedback={false}
                lockedMessage="Revisao do simulado finalizado."
                mode="review"
                onAnswerSubmit={() => undefined}
              />
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
