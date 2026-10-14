'use client';

import React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import type { Question, UserAnswer } from '@types';
import { useAuth } from '@providers/AuthProvider';
import { questionService } from '@services/questions';
import AuthModal from '@/components/shared/overlays/AuthModal';
import QuestionCard from '@/app/questions/components/QuestionCard';
import {
  PLATFORM_MAIN_CONTENT_WIDTH_CLASS,
  PLATFORM_PAGE_DESCRIPTION_CLASS,
  PLATFORM_PAGE_TITLE_CLASS,
  PLATFORM_SECTION_TITLE_CLASS,
  PLATFORM_SURFACE_CARD_CLASS,
} from '@constants/layout';
import { buildQuestionPath, buildQuestionSlug } from '@services/seo';
import { publicRoutes } from '@services/routes/publicRoutes';
import { buildQuestionPageHeading } from './questionSeo';

type PublicTaxonomyLink = { key: string; label: string; href: string };

const getQuestionRoleLabel = (item: unknown) => {
  if (!item || typeof item !== 'object') return '';
  const record = item as Record<string, unknown>;
  return String(record.descricao || record['descrição'] || record.name || record.nome || '').trim();
};

const readQuestionTaxonomyLinks = (question: Question): PublicTaxonomyLink[] => {
  const links = new Map<string, PublicTaxonomyLink>();
  const add = (value: unknown, fallbackLevel = '') => {
    if (!value || typeof value !== 'object') return;
    const record = value as Record<string, unknown>;
    const slug = String(record.slug || '').trim();
    const label = String(record.label || record.nome || record.name || '').trim();
    const level = String(record.taxonomyLevel || record.taxonomy_level || fallbackLevel).trim().toLowerCase();
    if (record.seoReady !== true || !slug || !label || !/^[a-z0-9-]+$/.test(slug)) return;
    const href = level === 'materia'
      ? publicRoutes.disciplines.detail(slug)
      : level === 'topico'
        ? publicRoutes.topics.detail(slug)
        : level === 'assunto'
          ? publicRoutes.subjects.detail(slug)
          : level === 'cargo'
            ? publicRoutes.positions.detail(slug)
            : level === 'carreira'
              ? publicRoutes.careers.detail(slug)
              : '';
    if (href) links.set(href, { key: `${level}:${slug}`, label, href });
  };

  (question.filters?.subjects || question.filters?.materias || []).forEach((item) => add(item, 'materia'));
  (question.filters?.topics || question.filters?.topicos || []).forEach((item) => add(item, 'topico'));
  (question.filters?.subtopics || question.filters?.assuntos || []).forEach((item) => add(item));
  (question.filters?.roles || question.filters?.cargos || []).forEach((item) => add(item, 'cargo'));
  (question.filters?.careers || question.filters?.carreiras || []).forEach((item) => add(item, 'carreira'));
  (question.assuntos || []).forEach((item) => add(item, item.materia ? 'materia' : ''));
  return [...links.values()];
};

type QuestionPublicPageProps = {
  initialQuestion?: Question | null;
  routeFamily?: 'legacy' | 'future';
};

const QuestionPublicPage: React.FC<QuestionPublicPageProps> = ({
  initialQuestion = null,
  routeFamily = 'legacy',
}) => {
  const params = useParams<{ id?: string; slug?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const routeSlug = Array.isArray(params.slug) ? params.slug.join('/') : params.slug;
  const router = useRouter();
  const { currentUser, toggleSavedQuestion } = useAuth();
  const [question, setQuestion] = React.useState<Question | null>(initialQuestion);
  const [isLoading, setIsLoading] = React.useState(!initialQuestion);
  const [error, setError] = React.useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = React.useState(false);
  const [relatedQuestions, setRelatedQuestions] = React.useState<Question[]>([]);
  const [completedRelatedRequestKey, setCompletedRelatedRequestKey] = React.useState('');
  const [previousQuestionPath, setPreviousQuestionPath] = React.useState<string | null>(null);
  const questionId = question?.id ? String(question.id) : '';

  React.useEffect(() => {
    let isMounted = true;
    const frameId = window.requestAnimationFrame(() => {
      if (!isMounted) return;
      if (!id) {
        setError('Questão não encontrada.');
        setIsLoading(false);
        return;
      }
      if (initialQuestion?.id && String(initialQuestion.id) === String(id)) {
        setQuestion(initialQuestion);
        setError(null);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      questionService.getQuestionById(id)
        .then((payload) => {
          if (!isMounted) return;
          setQuestion(payload);
          setError(null);
        })
        .catch((requestError) => {
          if (!isMounted) return;
          setError(requestError instanceof Error ? requestError.message : 'Não foi possível carregar a questão.');
        })
        .finally(() => { if (isMounted) setIsLoading(false); });
    });
    return () => {
      isMounted = false;
      window.cancelAnimationFrame(frameId);
    };
  }, [id, initialQuestion]);

  const canonicalPath = React.useMemo(() => question?.id ? buildQuestionPath(question) : null, [question]);

  React.useEffect(() => {
    if (routeFamily !== 'legacy' || !question?.id || !canonicalPath) return;
    if (routeSlug !== buildQuestionSlug(question)) router.replace(canonicalPath);
  }, [canonicalPath, question, routeFamily, routeSlug, router]);

  const taxonomyLinks = React.useMemo(() => question ? readQuestionTaxonomyLinks(question) : [], [question]);
  const relatedTaxonomy = React.useMemo(() => {
    const item = question?.assuntos?.find((subject) => subject.materia) || question?.assuntos?.[0];
    const label = String(item?.nome || item?.name || '').trim();
    if (!label) return null;
    return { key: item?.materia ? 'subject' : 'topic', label };
  }, [question]);
  const relatedRequestKey = relatedTaxonomy ? `${questionId}:${relatedTaxonomy.key}:${relatedTaxonomy.label}` : '';
  const isLoadingRelatedQuestions = Boolean(relatedRequestKey && completedRelatedRequestKey !== relatedRequestKey);

  React.useEffect(() => {
    if (!questionId || !relatedTaxonomy || !relatedRequestKey) return;
    let isMounted = true;
    questionService.getQuestionPage({
      [relatedTaxonomy.key]: relatedTaxonomy.label,
      limit: 30,
      content_scope: 'list',
    }).then(({ rows }) => {
      if (!isMounted) return;
      const seen = new Set([questionId]);
      setRelatedQuestions(rows.filter((item) => {
        const relatedId = String(item.id || '');
        if (!relatedId || seen.has(relatedId)) return false;
        seen.add(relatedId);
        return Boolean(String(item.enunciado_clean || item.enunciado || '').trim());
      }).slice(0, 6));
    }).catch(() => {
      if (isMounted) setRelatedQuestions([]);
    }).finally(() => {
      if (isMounted) setCompletedRelatedRequestKey(relatedRequestKey);
    });
    return () => { isMounted = false; };
  }, [questionId, relatedTaxonomy, relatedRequestKey]);

  React.useEffect(() => {
    if (!questionId || typeof window === 'undefined') return;
    const frameId = window.requestAnimationFrame(() => {
      try {
        const storageKey = 'cm-public-question-navigation-v1';
        const history = JSON.parse(window.sessionStorage.getItem(storageKey) || '[]') as Array<{ id: string; path: string }>;
        const currentPath = `${window.location.pathname}${window.location.search}`;
        const previous = [...history].reverse().find((entry) => entry.id !== questionId && entry.path.startsWith('/questoes/'));
        setPreviousQuestionPath(previous?.path || null);
        const nextHistory = [...history.filter((entry) => entry.id !== questionId), { id: questionId, path: currentPath }].slice(-30);
        window.sessionStorage.setItem(storageKey, JSON.stringify(nextHistory));
      } catch {
        setPreviousQuestionPath(null);
      }
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [questionId]);

  const relatedExams = React.useMemo(() => (question?.provas || []).filter((exam) => (
    Boolean(String(exam.slug || '').trim())
    && exam.publishStatus !== 'draft'
    && exam.visibilityStatus !== 'internal'
  )).slice(0, 6), [question]);

  const searchableContext = React.useMemo(() => {
    if (!question) return '';
    const subjects = question.assuntos?.map((item) => item.nome || item.name).filter(Boolean).slice(0, 3).join(', ');
    const boards = question.bancas?.map((item) => item.sigla || item.nome).filter(Boolean).slice(0, 2).join(', ');
    const roles = question.cargos?.map(getQuestionRoleLabel).filter(Boolean).slice(0, 2).join(', ');
    const years = question.anos?.filter(Boolean).join(', ');
    const context = [
      subjects ? `o assunto ${subjects}` : '',
      boards ? `a banca ${boards}` : '',
      roles ? `o cargo ${roles}` : '',
      years ? `o ano ${years}` : '',
    ].filter(Boolean);
    return context.length
      ? `Esta questão de concurso aborda ${context.join(', ')}. Consulte o enunciado e as alternativas e continue estudando por questões do mesmo assunto e provas às quais a questão está vinculada.`
      : 'Consulte o enunciado e as alternativas desta questão de concurso e continue estudando por questões do mesmo assunto e provas vinculadas.';
  }, [question]);

  const handleSubmitAnswer = React.useCallback(async (
    answer: Omit<UserAnswer, 'isCorrect' | 'correctOptionIndex'>,
  ): Promise<UserAnswer> => {
    const result = await questionService.submitUserAnswer(answer);
    if (!result.answer) throw new Error(result.message || 'A resposta não foi confirmada pelo servidor.');
    return {
      ...answer,
      selectedOptionIndex: result.answer.selectedOptionIndex,
      correctOptionIndex: result.answer.correctOptionIndex,
      isCorrect: result.answer.isCorrect,
    };
  }, []);

  if (isLoading) {
    return (
      <section className={`mx-auto w-full ${PLATFORM_MAIN_CONTENT_WIDTH_CLASS} px-4 py-8 sm:px-6 lg:px-8`}>
        <div className={`${PLATFORM_SURFACE_CARD_CLASS} flex min-h-[320px] items-center justify-center p-8`}>
          <div className="flex items-center gap-3 text-sm font-bold text-slate-500 dark:text-slate-400">
            <Loader2 size={18} className="animate-spin text-indigo-600" /> Carregando questão pública...
          </div>
        </div>
      </section>
    );
  }

  if (error || !question) {
    return (
      <section className={`mx-auto w-full ${PLATFORM_MAIN_CONTENT_WIDTH_CLASS} px-4 py-8 sm:px-6 lg:px-8`}>
        <div className={`${PLATFORM_SURFACE_CARD_CLASS} space-y-4 p-8`}>
          <p className="text-xs font-black uppercase text-rose-600">Questão indisponível</p>
          <h1 className={PLATFORM_PAGE_TITLE_CLASS}>Não foi possível abrir esta questão</h1>
          <p className={PLATFORM_PAGE_DESCRIPTION_CLASS}>{error || 'A questão solicitada não está disponível no momento.'}</p>
          <Link href={publicRoutes.questions.index()} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-3 text-sm font-bold text-white hover:bg-indigo-700">
            Ir para questões <ArrowRight size={15} />
          </Link>
        </div>
      </section>
    );
  }

  const nextQuestion = relatedTaxonomy ? relatedQuestions[0] : undefined;
  const nextQuestionPath = nextQuestion ? buildQuestionPath(nextQuestion) : null;
  const questionSubject = question.assuntos?.map((item) => item.nome || item.name).filter(Boolean)[0];
  const savedQuestionIds = currentUser?.savedQuestionIds || [];

  return (
    <>
      <main className={`mx-auto w-full ${PLATFORM_MAIN_CONTENT_WIDTH_CLASS} space-y-5 px-4 py-6 sm:px-6 lg:px-8`}>
        <header className="space-y-2">
          <h1 className={PLATFORM_PAGE_TITLE_CLASS}>{buildQuestionPageHeading(question)}</h1>
          <p className={PLATFORM_PAGE_DESCRIPTION_CLASS}>Confira o enunciado e as alternativas desta questão, veja os dados da prova e continue o estudo por assuntos relacionados.</p>
        </header>

        {taxonomyLinks.length > 0 && (
          <nav aria-label="Estudar por assunto" className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-500">Estudar por:</span>
            {taxonomyLinks.map((item) => (
              <Link key={item.key} href={item.href} prefetch={false} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-indigo-300 hover:text-[#615fff] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                {item.label}
              </Link>
            ))}
          </nav>
        )}

        <QuestionCard
          key={questionId}
          question={question}
          indexDisplay={1}
          onAnswerSubmit={handleSubmitAnswer}
          onGuestAction={() => setShowAuthModal(true)}
          onToggleSave={() => { void toggleSavedQuestion(questionId); }}
          isSaved={savedQuestionIds.some((savedId) => String(savedId) === questionId)}
          currentUserId={String(currentUser?.id || '')}
          currentUserName={currentUser?.name || 'Visitante'}
          hideFeedback={false}
        />

        <nav aria-label="Navegação entre questões" className="grid grid-cols-2 items-center gap-2 sm:grid-cols-[1fr_auto_1fr]">
          <button
            type="button"
            onClick={() => previousQuestionPath ? router.push(previousQuestionPath) : router.push(publicRoutes.questions.index())}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 hover:border-indigo-400 hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <ArrowLeft size={15} /> {previousQuestionPath ? 'Questão anterior' : 'Voltar às questões'}
          </button>
          <span className="hidden text-xs text-slate-500 sm:block">Q{questionId}</span>
          {nextQuestionPath ? (
            <Link href={nextQuestionPath} rel="next" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 text-xs font-bold text-white hover:bg-indigo-700">
              Próxima questão <ArrowRight size={15} />
            </Link>
          ) : (
            <button type="button" disabled className="inline-flex min-h-10 cursor-not-allowed items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 text-xs font-bold text-white opacity-50">
              Próxima questão <ArrowRight size={15} />
            </button>
          )}
        </nav>

        <div className="grid items-start gap-4 md:grid-cols-2">
          <section aria-labelledby="related-questions-title" className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <header className="border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
              <h2 id="related-questions-title" className={PLATFORM_SECTION_TITLE_CLASS}>Questões de assuntos semelhantes</h2>
              <p className="mt-1 text-xs text-slate-500">Questões publicadas do mesmo assunto</p>
            </header>
            {isLoadingRelatedQuestions ? (
              <div className="flex min-h-24 items-center justify-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> Buscando questões</div>
            ) : relatedTaxonomy && relatedQuestions.length ? (
              <ul className="divide-y divide-slate-200 px-4 dark:divide-slate-800">
                {relatedQuestions.map((item) => {
                  const title = String(item.enunciado_clean || item.enunciado || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
                  const detail = [item.assuntos?.[0]?.nome, item.bancas?.[0]?.sigla || item.bancas?.[0]?.nome, item.anos?.[0]].filter(Boolean).join(' · ');
                  return (
                    <li key={String(item.id)}>
                      <Link href={buildQuestionPath(item)} className="block py-3 hover:text-indigo-600">
                        <span className="line-clamp-3 text-sm font-bold leading-5">{title}</span>
                        {detail && <span className="mt-1 block text-xs text-slate-500">{detail}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="px-4 py-5 text-sm text-slate-500">Não encontramos outras questões publicadas deste assunto.</p>
            )}
          </section>

          <section aria-labelledby="related-exams-title" className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <header className="border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
              <h2 id="related-exams-title" className={PLATFORM_SECTION_TITLE_CLASS}>Provas relacionadas</h2>
              <p className="mt-1 text-xs text-slate-500">Provas vinculadas a esta questão</p>
            </header>
            {relatedExams.length ? (
              <ul className="divide-y divide-slate-200 px-4 dark:divide-slate-800">
                {relatedExams.map((exam) => (
                  <li key={exam.id}>
                    <Link href={publicRoutes.exams.detail(exam.slug)} className="block py-3 hover:text-indigo-600">
                      <span className="block text-sm font-bold leading-5">{exam.nome}</span>
                      <span className="mt-1 block text-xs text-slate-500">{[exam.ano, exam.banca?.sigla || exam.banca?.nome, getQuestionRoleLabel(exam.cargo)].filter(Boolean).join(' · ')}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-5 text-sm text-slate-500">Esta questão ainda não tem prova pública vinculada.</p>
            )}
          </section>
        </div>

        <section aria-labelledby="question-search-context" className="border-t border-slate-200 pt-5 dark:border-slate-800">
          <h2 id="question-search-context" className={PLATFORM_SECTION_TITLE_CLASS}>
            {questionSubject ? `Questão de concurso sobre ${questionSubject}` : 'Questão de concurso'}
          </h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600 dark:text-slate-300">{searchableContext}</p>
        </section>
      </main>
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        title="Entre para responder"
        description="Crie uma conta gratuita ou acesse sua conta para responder esta questão, salvar seu progresso e acompanhar seus resultados."
        actionSource="questao-publica"
      />
    </>
  );
};

export default QuestionPublicPage;
