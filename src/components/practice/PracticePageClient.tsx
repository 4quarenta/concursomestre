'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  Filter,
  Loader2,
  RotateCcw,
  Search,
} from 'lucide-react';
import { useAuthSession } from '@/components/auth/AuthSessionProvider';
import QuestionAttemptCard from '@/components/questions/QuestionAttemptCard';
import FeaturePlaceholderPage from '@/components/shared/FeaturePlaceholderPage';
import { readApiErrorMessage } from '@/lib/browserApi';
import { questionService } from '@/services/questions';
import type { Question, SystemSettings, UserAnswer } from '@/types';

export type PracticeFilters = {
  agency: string;
  difficulty: string;
  keyword: string;
  onlySaved: boolean;
  organization: string;
  subject: string;
  topic: string;
  year: string;
};

type PracticePageClientProps = {
  highlightedQuestionId?: string;
  initialFilters: PracticeFilters;
  systemSettings: SystemSettings;
};

type Notice = {
  text: string;
  type: 'error' | 'success' | 'warning';
};

const PAGE_SIZE = 12;

export const DEFAULT_PRACTICE_FILTERS: PracticeFilters = {
  agency: 'All',
  difficulty: 'All',
  keyword: '',
  onlySaved: false,
  organization: 'All',
  subject: 'All',
  topic: 'All',
  year: 'All',
};

const DIFFICULTY_OPTIONS = [
  { label: 'Muito facil', value: '1' },
  { label: 'Facil', value: '2' },
  { label: 'Medio', value: '3' },
  { label: 'Dificil', value: '4' },
  { label: 'Muito dificil', value: '5' },
];

const buildQuestionFilters = (filters: PracticeFilters, page: number, currentUserId?: string) => ({
  page,
  limit: PAGE_SIZE,
  keyword: filters.keyword.trim(),
  subject: filters.subject,
  materia: filters.subject,
  topic: filters.topic,
  assunto: filters.topic,
  agency: filters.agency,
  banca: filters.agency,
  organization: filters.organization,
  orgao: filters.organization,
  year: filters.year,
  difficulty: filters.difficulty,
  dificuldade: filters.difficulty,
  onlySaved: filters.onlySaved,
  user_id: filters.onlySaved ? currentUserId : undefined,
});

const uniqueSorted = (items: Array<string | number | null | undefined>) => (
  Array.from(new Set(items.map((item) => String(item || '').trim()).filter(Boolean)))
    .sort((left, right) => left.localeCompare(right, 'pt-BR'))
);

const getSubjectOptions = (settings: SystemSettings, questions: Question[]) => {
  if (settings.taxonomies?.subjects?.length) {
    return uniqueSorted(settings.taxonomies.subjects.map((item) => item.name));
  }

  return uniqueSorted(
    questions.flatMap((question) => question.assuntos?.filter((item) => item.materia).map((item) => item.nome) || []),
  );
};

const getTopicOptions = (settings: SystemSettings, questions: Question[]) => {
  if (settings.taxonomies?.topics?.length) {
    return uniqueSorted(settings.taxonomies.topics.map((item) => item.name));
  }

  return uniqueSorted(
    questions.flatMap((question) => question.assuntos?.filter((item) => !item.materia).map((item) => item.nome) || []),
  );
};

const getAgencyOptions = (settings: SystemSettings, questions: Question[]) => {
  if (settings.taxonomies?.agencies?.length) {
    return uniqueSorted(settings.taxonomies.agencies.map((item) => item.name || item.slug));
  }

  return uniqueSorted(
    questions.flatMap((question) => question.bancas?.map((item) => item.sigla || item.nome) || []),
  );
};

const getOrganizationOptions = (settings: SystemSettings, questions: Question[]) => {
  if (settings.taxonomies?.organizations?.length) {
    return uniqueSorted(settings.taxonomies.organizations.map((item) => item.name || item.slug));
  }

  return uniqueSorted(
    questions.flatMap((question) => question.orgaos?.map((item) => item.sigla || item.nome) || []),
  );
};

const getYearOptions = (settings: SystemSettings, questions: Question[]) => {
  if (settings.taxonomies?.years?.length) {
    return uniqueSorted(settings.taxonomies.years).sort((left, right) => right.localeCompare(left, 'pt-BR'));
  }

  return uniqueSorted(questions.flatMap((question) => question.anos || []))
    .sort((left, right) => right.localeCompare(left, 'pt-BR'));
};

function FilterSelect({
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
        className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none transition focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
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

export default function PracticePageClient({
  highlightedQuestionId = '',
  initialFilters,
  systemSettings,
}: PracticePageClientProps) {
  const { currentUser, isLoading: isAuthLoading, refreshUser } = useAuthSession();
  const [filters, setFilters] = useState<PracticeFilters>(initialFilters);
  const [pendingFilters, setPendingFilters] = useState<PracticeFilters>(initialFilters);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [savingQuestionId, setSavingQuestionId] = useState<string | null>(null);
  const [answersByQuestionId, setAnswersByQuestionId] = useState<Record<string, UserAnswer>>({});
  const [notice, setNotice] = useState<Notice | null>(null);

  const featureEnabled = systemSettings.features.practiceEnabled !== false;

  const savedQuestionIds = useMemo(
    () => new Set((currentUser?.savedQuestionIds || []).map(String)),
    [currentUser?.savedQuestionIds],
  );

  const subjectOptions = useMemo(() => getSubjectOptions(systemSettings, questions), [questions, systemSettings]);
  const topicOptions = useMemo(() => getTopicOptions(systemSettings, questions), [questions, systemSettings]);
  const agencyOptions = useMemo(() => getAgencyOptions(systemSettings, questions), [questions, systemSettings]);
  const organizationOptions = useMemo(() => getOrganizationOptions(systemSettings, questions), [questions, systemSettings]);
  const yearOptions = useMemo(() => getYearOptions(systemSettings, questions), [questions, systemSettings]);

  const loadQuestions = useCallback(async (page: number, append = false) => {
    if (!featureEnabled) {
      return;
    }

    if (append) {
      setIsLoadingMore(true);
    } else {
      setIsLoadingQuestions(true);
    }

    setNotice(null);

    try {
      if (highlightedQuestionId) {
        const question = await questionService.getQuestionById(highlightedQuestionId);
        setQuestions(question?.id ? [question] : []);
        setTotalQuestions(question?.id ? 1 : 0);
        setCurrentPage(1);
        return;
      }

      const result = await questionService.getQuestionPage(
        buildQuestionFilters(filters, page, currentUser?.id),
      );

      setQuestions((current) => (append ? [...current, ...result.rows] : result.rows));
      setTotalQuestions(result.total);
      setCurrentPage(page);
    } catch (error) {
      setNotice({
        type: 'error',
        text: readApiErrorMessage(error, 'Nao foi possivel carregar as questoes agora.'),
      });

      if (!append) {
        setQuestions([]);
        setTotalQuestions(0);
      }
    } finally {
      setIsLoadingQuestions(false);
      setIsLoadingMore(false);
    }
  }, [currentUser?.id, featureEnabled, filters, highlightedQuestionId]);

  useEffect(() => {
    void loadQuestions(1, false);
  }, [loadQuestions]);

  const handleApplyFilters = () => {
    setFilters(pendingFilters);
  };

  const handleClearFilters = () => {
    setPendingFilters(DEFAULT_PRACTICE_FILTERS);
    setFilters(DEFAULT_PRACTICE_FILTERS);
  };

  const handleAnswerSubmit = async (answer: UserAnswer) => {
    if (!currentUser) {
      setNotice({ type: 'warning', text: 'Entre para responder e salvar seu historico de questoes.' });
      return;
    }

    if (!currentUser.emailVerified) {
      setNotice({ type: 'warning', text: 'Confirme seu e-mail antes de registrar respostas.' });
      return;
    }

    setSavingQuestionId(String(answer.questionId));
    setNotice(null);

    try {
      await questionService.submitUserAnswer(currentUser.id, answer);
      setAnswersByQuestionId((current) => ({
        ...current,
        [String(answer.questionId)]: answer,
      }));
      await refreshUser();
      setNotice({ type: 'success', text: 'Resposta registrada no seu historico.' });
    } catch (error) {
      setNotice({ type: 'error', text: readApiErrorMessage(error, 'Nao foi possivel salvar a resposta.') });
    } finally {
      setSavingQuestionId(null);
    }
  };

  const handleToggleSaved = async (question: Question) => {
    if (!currentUser) {
      setNotice({ type: 'warning', text: 'Entre para salvar questoes na sua lista.' });
      return;
    }

    setSavingQuestionId(String(question.id));
    setNotice(null);

    try {
      await questionService.toggleSavedQuestion(currentUser.id, question.id || '');
      await refreshUser();
      setNotice({ type: 'success', text: 'Lista de salvos atualizada.' });
    } catch (error) {
      setNotice({ type: 'error', text: readApiErrorMessage(error, 'Nao foi possivel atualizar os salvos.') });
    } finally {
      setSavingQuestionId(null);
    }
  };

  if (!featureEnabled) {
    return (
      <FeaturePlaceholderPage
        title="Questoes"
        description="Modulo reservado para pratica guiada com filtros, respostas e historico."
        icon={Search}
        isEnabled={false}
        featureLabel="Questoes"
        backHref="/"
      />
    );
  }

  const canAnswer = Boolean(currentUser && currentUser.emailVerified);
  const canLoadMore = !highlightedQuestionId && questions.length < totalQuestions;

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 text-slate-900 dark:text-slate-100 sm:px-6 lg:px-8">
      <header className="grid gap-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-700 dark:text-emerald-300">
            Banco de questoes
          </p>
          <h1 className="text-3xl font-black tracking-tight md:text-5xl">
            Resolva questoes com filtros reais da plataforma.
          </h1>
          <p className="max-w-3xl text-sm font-medium leading-7 text-slate-500 dark:text-slate-400">
            Treine por banca, orgao, materia, assunto e ano. Ao responder com uma conta confirmada, o historico alimenta seu desempenho.
          </p>
        </div>

        <aside className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-800 dark:text-emerald-200">
            Sessao
          </p>
          <p className="mt-2 text-sm font-bold leading-6 text-slate-700 dark:text-slate-200">
            {isAuthLoading
              ? 'Validando sua sessao...'
              : currentUser
                ? `${currentUser.name} - ${currentUser.emailVerified ? 'e-mail confirmado' : 'e-mail pendente'}`
                : 'Visitante: entre para salvar respostas e questoes.'}
          </p>
          {!currentUser && !isAuthLoading ? (
            <Link
              href="/auth?next=%2Fpractice"
              className="mt-4 inline-flex items-center justify-center rounded-lg bg-emerald-700 px-4 py-2.5 text-xs font-black uppercase tracking-[0.16em] text-white transition hover:bg-emerald-800"
            >
              Entrar
            </Link>
          ) : null}
        </aside>
      </header>

      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-emerald-700 dark:text-emerald-300" />
            <h2 className="text-xl font-black">Filtros</h2>
          </div>
          <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
            {questions.length} de {totalQuestions || questions.length} questoes
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-2 md:col-span-2">
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Palavra-chave
            </span>
            <input
              value={pendingFilters.keyword}
              onChange={(event) => setPendingFilters((current) => ({ ...current, keyword: event.target.value }))}
              placeholder="Buscar no enunciado"
              className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none transition focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>

          <FilterSelect
            label="Materia"
            value={pendingFilters.subject}
            options={subjectOptions}
            onChange={(value) => setPendingFilters((current) => ({ ...current, subject: value, topic: 'All' }))}
          />
          <FilterSelect
            label="Assunto"
            value={pendingFilters.topic}
            options={topicOptions}
            onChange={(value) => setPendingFilters((current) => ({ ...current, topic: value }))}
          />
          <FilterSelect
            label="Banca"
            value={pendingFilters.agency}
            options={agencyOptions}
            onChange={(value) => setPendingFilters((current) => ({ ...current, agency: value }))}
          />
          <FilterSelect
            label="Orgao"
            value={pendingFilters.organization}
            options={organizationOptions}
            onChange={(value) => setPendingFilters((current) => ({ ...current, organization: value }))}
          />
          <FilterSelect
            label="Ano"
            value={pendingFilters.year}
            options={yearOptions}
            onChange={(value) => setPendingFilters((current) => ({ ...current, year: value }))}
          />
          <label className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Dificuldade
            </span>
            <select
              value={pendingFilters.difficulty}
              onChange={(event) => setPendingFilters((current) => ({ ...current, difficulty: event.target.value }))}
              className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none transition focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="All">Todas</option>
              {DIFFICULTY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-slate-600 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-300">
            <input
              type="checkbox"
              checked={pendingFilters.onlySaved}
              onChange={(event) => setPendingFilters((current) => ({ ...current, onlySaved: event.target.checked }))}
              className="h-4 w-4 accent-emerald-700"
            />
            Apenas salvas
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleClearFilters}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-xs font-black uppercase tracking-[0.16em] text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <RotateCcw size={14} />
              Limpar
            </button>
            <button
              type="button"
              onClick={handleApplyFilters}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-black uppercase tracking-[0.16em] text-white transition hover:bg-slate-800 dark:bg-emerald-700 dark:hover:bg-emerald-800"
            >
              <Search size={14} />
              Aplicar
            </button>
          </div>
        </div>
      </section>

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

      {isLoadingQuestions ? (
        <section className="rounded-lg border border-slate-200 bg-white px-6 py-16 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <Loader2 className="mx-auto animate-spin text-emerald-700 dark:text-emerald-300" size={34} />
          <p className="mt-4 text-sm font-bold text-slate-500 dark:text-slate-400">Carregando questoes...</p>
        </section>
      ) : questions.length === 0 ? (
        <section className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <Search className="mx-auto text-slate-300 dark:text-slate-600" size={40} />
          <h2 className="mt-4 text-xl font-black">Nenhuma questao encontrada</h2>
          <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
            Ajuste os filtros para ampliar o recorte.
          </p>
        </section>
      ) : (
        <section className="space-y-5">
          {questions.map((question, index) => {
            const questionId = String(question.id);
            const isSaved = savedQuestionIds.has(questionId);

            return (
              <div key={`${questionId}-${index}`} className="space-y-2">
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleToggleSaved(question)}
                    disabled={savingQuestionId === questionId}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-600 transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    {isSaved ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
                    {isSaved ? 'Salva' : 'Salvar'}
                  </button>
                </div>
                <QuestionAttemptCard
                  question={question}
                  indexDisplay={(currentPage - 1) * PAGE_SIZE + index + 1}
                  answer={answersByQuestionId[questionId]}
                  canAnswer={canAnswer}
                  isSaving={savingQuestionId === questionId}
                  lockedMessage={currentUser ? 'Confirme seu e-mail para registrar respostas.' : 'Entre para responder e salvar seu historico.'}
                  onAuthRequired={() => setNotice({ type: 'warning', text: 'Entre para responder e salvar seu historico.' })}
                  onAnswerSubmit={handleAnswerSubmit}
                />
              </div>
            );
          })}

          {canLoadMore ? (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={() => loadQuestions(currentPage + 1, true)}
                disabled={isLoadingMore}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-white transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60 dark:bg-emerald-700 dark:hover:bg-emerald-800"
              >
                {isLoadingMore ? <Loader2 className="animate-spin" size={15} /> : <CheckCircle2 size={15} />}
                Carregar mais
              </button>
            </div>
          ) : null}
        </section>
      )}
    </main>
  );
}
