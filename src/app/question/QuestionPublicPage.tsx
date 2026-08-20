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

import React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AlertTriangle, ArrowRight, BookOpenCheck, Building2, Calendar, CheckCircle2, FileQuestion, GraduationCap, Loader2, ShieldCheck, Sparkles, Tag, UserPlus } from 'lucide-react';
import type { Question } from '@types';
import { useAuth } from '@providers/AuthProvider';
import { isPlatformOriginalQuestion, isQuestionCanceled, questionService } from '@services/questions';
import { normalizeQuestionRichHtml } from '@services/questions/questionHtmlSanitizer';
import AuthModal from '@/components/shared/overlays/AuthModal';
import {
  PLATFORM_MAIN_CONTENT_WIDTH_CLASS,
  PLATFORM_PAGE_DESCRIPTION_CLASS,
  PLATFORM_PAGE_TITLE_CLASS,
  PLATFORM_SECTION_TITLE_CLASS,
  PLATFORM_SURFACE_CARD_CLASS,
} from '@constants/layout';
import { buildAbsoluteUrl, buildBoardPath, buildQuestionPath, buildQuestionSlug } from '@services/seo';
import { publicRoutes } from '@services/routes/publicRoutes';
import {
  buildQuestionKeywordPills,
  buildQuestionKeywords,
  buildQuestionMetaDescription,
  buildQuestionMetaTitle,
  buildQuestionPageHeading,
  getQuestionContextLabels,
} from './questionSeo';

const optionLetters = ['A', 'B', 'C', 'D', 'E', 'F'];

const serializeJsonLd = (payload: unknown) => (
  JSON.stringify(payload)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
);

const getQuestionRoleLabel = (item: unknown) => {
  if (!item || typeof item !== 'object') {
    return '';
  }

  const record = item as Record<string, unknown>;
  return String(record.descricao || record['descrição'] || record.name || '').trim();
};

type PublicTaxonomyLink = { key: string; label: string; href: string };

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
  canonicalUrl?: string | null;
};

const QuestionPublicPage: React.FC<QuestionPublicPageProps> = ({
  initialQuestion = null,
  routeFamily = 'legacy',
  canonicalUrl = null,
}) => {
  const params = useParams<{ id?: string; slug?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const routeSlug = Array.isArray(params.slug) ? params.slug.join('/') : params.slug;
  const router = useRouter();
  const { currentUser, isLoading: isAuthLoading } = useAuth();
  const [question, setQuestion] = React.useState<Question | null>(initialQuestion);
  const [isLoading, setIsLoading] = React.useState(!initialQuestion);
  const [error, setError] = React.useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = React.useState(false);

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
          if (!isMounted) {
            return;
          }

          setQuestion(payload);
          setError(null);
        })
        .catch((requestError) => {
          if (!isMounted) {
            return;
          }

          setError(requestError instanceof Error ? requestError.message : 'Não foi possível carregar a questão.');
        })
        .finally(() => {
          if (isMounted) {
            setIsLoading(false);
          }
        });
    });

    return () => {
      isMounted = false;
      window.cancelAnimationFrame(frameId);
    };
  }, [id, initialQuestion]);

  const canonicalPath = React.useMemo(() => {
    if (!question?.id) {
      return null;
    }

    return buildQuestionPath(question);
  }, [question]);

  React.useEffect(() => {
    if (routeFamily !== 'legacy' || !question?.id || !canonicalPath) {
      return;
    }

    const canonicalSlug = buildQuestionSlug(question);
    if (routeSlug !== canonicalSlug) {
      router.replace(canonicalPath);
    }
  }, [canonicalPath, question, routeFamily, routeSlug, router]);

  const questionContext = React.useMemo(() => question ? getQuestionContextLabels(question) : null, [question]);
  const questionKeywords = React.useMemo(() => question ? buildQuestionKeywords(question) : [], [question]);
  const keywordPills = React.useMemo(() => question ? buildQuestionKeywordPills(question) : [], [question]);
  const taxonomyLinks = React.useMemo(() => question ? readQuestionTaxonomyLinks(question) : [], [question]);

  const metadataItems = [
    { label: 'Banca', value: question?.bancas?.map((item) => item.sigla || item.nome).filter(Boolean).join(', ') },
    { label: 'Órgão', value: question?.orgaos?.map((item) => item.sigla || item.nome).filter(Boolean).join(', ') },
    { label: 'Cargo', value: question?.cargos?.map(getQuestionRoleLabel).filter(Boolean).join(', ') },
    { label: 'Ano', value: question?.anos?.join(', ') },
    { label: 'Assuntos', value: question?.assuntos?.map((item) => item.nome).filter(Boolean).join(', ') },
    { label: 'Modalidade', value: question?.tipo === 'certo ou errado' ? 'Certo ou errado' : 'Múltipla escolha' },
  ].filter((item) => item.value);

  const structuredData = React.useMemo(() => {
    if (!question) return null;

    return {
      '@context': 'https://schema.org',
      '@type': 'Quiz',
      name: buildQuestionMetaTitle(question),
      description: buildQuestionMetaDescription(question),
      url: canonicalUrl || buildAbsoluteUrl(canonicalPath || buildQuestionPath(question)),
      educationalLevel: questionContext?.nivel || 'Concursos públicos',
      about: keywordPills,
      assesses: questionContext?.assuntos?.join(', ') || questionContext?.assunto || 'Conhecimentos para concursos',
      provider: {
        '@type': 'Organization',
        name: 'ConcursoMestre',
        url: canonicalUrl ? new URL('/', canonicalUrl).toString() : buildAbsoluteUrl('/'),
      },
    };
  }, [canonicalPath, canonicalUrl, keywordPills, question, questionContext]);
  const showFreeAccountCta = !isAuthLoading && !currentUser;
  const isCanceledQuestion = question ? isQuestionCanceled(question) : false;
  const isOriginalQuestion = question ? isPlatformOriginalQuestion(question) : false;
  const questionId = question?.id ? String(question.id) : '';

  const handleOpenPractice = React.useCallback(() => {
    if (!questionId || isAuthLoading) {
      return;
    }

    if (isCanceledQuestion) {
      return;
    }

    if (!currentUser) {
      setShowAuthModal(true);
      return;
    }

    router.push(publicRoutes.questions.index({ questionId }));
  }, [currentUser, isAuthLoading, isCanceledQuestion, questionId, router]);

  if (isLoading) {
    return (
      <section className={`mx-auto w-full ${PLATFORM_MAIN_CONTENT_WIDTH_CLASS} px-4 py-8 sm:px-6 lg:px-8`}>
        <div className={`${PLATFORM_SURFACE_CARD_CLASS} flex min-h-[320px] items-center justify-center p-8`}>
          <div className="flex items-center gap-3 text-sm font-bold text-slate-500 dark:text-slate-400">
            <Loader2 size={18} className="animate-spin text-indigo-600" />
            Carregando questão pública...
          </div>
        </div>
      </section>
    );
  }

  if (error || !question) {
    return (
      <section className={`mx-auto w-full ${PLATFORM_MAIN_CONTENT_WIDTH_CLASS} px-4 py-8 sm:px-6 lg:px-8`}>
        <div className={`${PLATFORM_SURFACE_CARD_CLASS} space-y-4 p-8`}>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-rose-600">Questão indisponível</p>
          <h1 className={PLATFORM_PAGE_TITLE_CLASS}>Não foi possível abrir esta questão</h1>
          <p className={PLATFORM_PAGE_DESCRIPTION_CLASS}>{error || 'A questão solicitada não está disponível no momento.'}</p>
          <Link
            href={publicRoutes.questions.index()}
            className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-white transition-all hover:bg-indigo-700"
          >
            Ir para a prática <ArrowRight size={14} />
          </Link>
        </div>
      </section>
    );
  }

  return (
    <>
    {structuredData && (
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }}
      />
    )}
    <section className={`mx-auto w-full ${PLATFORM_MAIN_CONTENT_WIDTH_CLASS} space-y-6 px-4 py-8 sm:px-6 lg:px-8`}>
      <div className={`${PLATFORM_SURFACE_CARD_CLASS} overflow-hidden ${isCanceledQuestion ? 'border-red-400 ring-2 ring-red-100 dark:border-red-700 dark:ring-red-900/30' : ''}`}>
        <div className="border-b border-slate-200 bg-gradient-to-br from-indigo-50 via-white to-sky-50 p-4 sm:p-5 md:p-6 dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">Questão comentada para concurso</p>
          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <h1 className={PLATFORM_PAGE_TITLE_CLASS}>{buildQuestionPageHeading(question)}</h1>
              <p className={PLATFORM_PAGE_DESCRIPTION_CLASS}>
                Resolva esta questão de concurso com enunciado, alternativas e filtros por banca, órgão, cargo, ano e assunto. Na prática, você também acompanha histórico, comentários e evolução dos seus acertos.
              </p>
              {(keywordPills.length > 0 || isOriginalQuestion || isCanceledQuestion) && (
                <div className="flex flex-wrap gap-2">
                  {isOriginalQuestion && (
                    <span className="inline-flex min-h-6 items-center justify-center rounded-md border border-violet-100 bg-violet-600 px-3 py-1 text-[10px] font-black uppercase leading-none tracking-widest text-white shadow-sm dark:border-violet-500/20">
                      Inédita
                    </span>
                  )}
                  {isCanceledQuestion && (
                    <span className="inline-flex min-h-6 items-center justify-center rounded-md border border-red-200 bg-red-600 px-3 py-1 text-[10px] font-black uppercase leading-none tracking-widest text-white shadow-sm dark:border-red-500/30">
                      Anulada
                    </span>
                  )}
                  {keywordPills.map((keyword) => (
                    <span key={keyword} className="inline-flex items-center gap-1.5 rounded-full border border-indigo-100 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-widest text-indigo-700 shadow-sm dark:border-indigo-500/20 dark:bg-slate-900 dark:text-indigo-300">
                      <BookOpenCheck size={12} />
                      {keyword}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <Link
              href={publicRoutes.questions.index({ questionId: question.id })}
              onClick={(event) => {
                event.preventDefault();
                handleOpenPractice();
              }}
              aria-disabled={isCanceledQuestion}
              className={`inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-white transition-all ${isCanceledQuestion ? 'cursor-not-allowed bg-red-500 opacity-80' : 'bg-indigo-600 hover:bg-indigo-700'}`}
            >
              {isCanceledQuestion ? 'Questão anulada' : 'Resolver na prática'} {!isCanceledQuestion && <ArrowRight size={14} />}
            </Link>
          </div>
        </div>

        <div className="space-y-6 p-4 sm:p-5 md:p-6">
          {metadataItems.length > 0 && (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {metadataItems.map((item) => (
                <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">{item.label}</p>
                  {item.label === 'Banca' && question.bancas?.length ? (
                    <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {question.bancas.map((board, index) => (
                        <React.Fragment key={`${board.id || board.slug || index}`}>
                          {index > 0 ? ', ' : null}
                          <Link href={buildBoardPath(board)} prefetch={false} className="hover:text-[#615fff] hover:underline">{board.sigla || board.nome}</Link>
                        </React.Fragment>
                      ))}
                    </p>
                  ) : <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{item.value}</p>}
                </div>
              ))}
            </div>
          )}

          {taxonomyLinks.length > 0 ? (
            <nav aria-label="Taxonomias da questão" className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-black text-slate-500 dark:text-slate-400">Estudar por:</span>
              {taxonomyLinks.map((item) => (
                <Link key={item.key} href={item.href} prefetch={false} className="rounded-md border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:border-indigo-300 hover:text-[#615fff] dark:border-slate-700 dark:text-slate-200">
                  {item.label}
                </Link>
              ))}
            </nav>
          ) : null}

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr),360px]">
            <article className="space-y-6 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 md:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                <FileQuestion size={14} />
                Questão #{question.id}
              </div>
              {question.introText && (
                <div
                  className="prose prose-slate max-w-none rounded-2xl border-l-2 border-indigo-200 bg-slate-50 p-4 text-sm italic leading-7 dark:prose-invert dark:border-indigo-800 dark:bg-slate-950 [&_img]:mx-auto [&_img]:my-3 [&_img]:max-h-[420px] [&_img]:w-auto [&_img]:max-w-full [&_img]:rounded-lg [&_img]:border [&_img]:border-slate-200 [&_img]:bg-white [&_img]:p-1 dark:[&_img]:border-slate-700 dark:[&_img]:bg-slate-900"
                  dangerouslySetInnerHTML={{ __html: normalizeQuestionRichHtml(question.introText) }}
                />
              )}
              {(question.referenceText || question.reference_text) && (
                <div className="rounded-2xl border-l-2 border-amber-300 bg-amber-50 p-4 text-sm leading-7 dark:border-amber-800 dark:bg-amber-950/30">
                  <div className="mb-1 text-[10px] font-black uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">Referência</div>
                  <div
                    className="prose prose-amber max-w-none text-sm font-semibold leading-7 text-amber-900 dark:prose-invert dark:text-amber-100"
                    dangerouslySetInnerHTML={{ __html: normalizeQuestionRichHtml(question.referenceText || question.reference_text || '') }}
                  />
                </div>
              )}
              <div
                className="prose prose-slate max-w-none text-sm leading-7 dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: normalizeQuestionRichHtml(question.enunciado || question.enunciado_clean || '') }}
              />

              {Array.isArray(question.itens) && question.itens.length > 0 ? (
                <div className="space-y-3">
                  <h2 className={PLATFORM_SECTION_TITLE_CLASS}>Alternativas</h2>
                  {isCanceledQuestion ? (
                    <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold leading-6 text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
                      <AlertTriangle className="mt-0.5 shrink-0" size={16} />
                      <span>Questão anulada. As alternativas ficam disponíveis apenas para consulta.</span>
                    </div>
                  ) : null}
                  {question.itens.map((item, index) => (
                    <div
                      key={`${item.id}-${item.ordem}-${index}`}
                      role="button"
                      tabIndex={isAuthLoading || isCanceledQuestion ? -1 : 0}
                      aria-disabled={isAuthLoading || isCanceledQuestion}
                      onClick={handleOpenPractice}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          handleOpenPractice();
                        }
                      }}
                      className={`w-full rounded-2xl border p-4 text-left transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 ${isCanceledQuestion ? 'cursor-not-allowed border-red-100 bg-red-50/40 opacity-80 dark:border-red-900/30 dark:bg-red-900/10' : 'border-slate-200 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-indigo-500/40 dark:hover:bg-indigo-500/10'} ${isAuthLoading ? 'cursor-wait opacity-70' : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-black text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
                          {item.rotulo || optionLetters[index] || String(index + 1)}
                        </span>
                        <div
                          className="prose prose-slate max-w-none text-sm leading-7 dark:prose-invert"
                          dangerouslySetInnerHTML={{ __html: normalizeQuestionRichHtml(item.corpo || item.corpo_clean || '') }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </article>

            <aside className="space-y-4">
              <div className={`${PLATFORM_SURFACE_CARD_CLASS} p-5`}>
                <h2 className={PLATFORM_SECTION_TITLE_CLASS}>Resumo rápido</h2>
                <div className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={16} className="text-emerald-600 dark:text-emerald-300" />
                    <span>{question.commentsCount || 0} comentários na comunidade</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar size={16} className="text-sky-600 dark:text-sky-300" />
                    <span>{question.anos?.length ? question.anos.join(', ') : 'Ano não informado'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Building2 size={16} className="text-indigo-600 dark:text-indigo-300" />
                    {question.bancas?.[0] ? (
                      <Link href={buildBoardPath(question.bancas[0])} prefetch={false} className="hover:text-[#615fff] hover:underline">{question.bancas[0].sigla || question.bancas[0].nome}</Link>
                    ) : <span>Banca não informada</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <GraduationCap size={16} className="text-amber-600 dark:text-amber-300" />
                    <span>Dificuldade {question.dificuldade}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Tag size={16} className="text-fuchsia-600 dark:text-fuchsia-300" />
                    <span>{question.tipo === 'certo ou errado' ? 'Certo ou errado' : 'Múltipla escolha'}</span>
                  </div>
                </div>
              </div>

              {showFreeAccountCta && (
                <div data-hydration-interaction className="overflow-hidden rounded-2xl border border-indigo-200 bg-indigo-50 p-5 shadow-sm dark:border-indigo-500/20 dark:bg-indigo-500/10">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-indigo-700 dark:text-indigo-300">
                    <Sparkles size={14} />
                    Conta gratuita
                  </div>
                  <h2 className="mt-3 text-base font-black text-slate-900 dark:text-slate-100">
                    Crie sua conta 100% gratuita
                  </h2>
                  <p className="mt-2 text-sm font-medium leading-6 text-slate-600 dark:text-slate-300">
                    Salve esta questão, acompanhe seu histórico de acertos, monte cadernos de revisão e continue estudando por banca, assunto e dificuldade.
                  </p>
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                      <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-300" />
                      Banco de questoes e progresso pessoal
                    </div>
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                      <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-300" />
                      Comentários, anotações e estatísticas
                    </div>
                  </div>
                  <Link
                    href="/auth?mode=signup"
                    className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-xs font-black uppercase tracking-[0.18em] text-white transition-all hover:bg-indigo-700"
                  >
                    Criar conta gratuita <UserPlus size={14} />
                  </Link>
                </div>
              )}

              {questionKeywords.length > 0 && (
                <div className={`${PLATFORM_SURFACE_CARD_CLASS} p-5`}>
                  <h2 className={PLATFORM_SECTION_TITLE_CLASS}>Temas relacionados</h2>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {questionKeywords.slice(0, 10).map((keyword) => (
                      <span key={keyword} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className={`${PLATFORM_SURFACE_CARD_CLASS} p-5`}>
                <h2 className={PLATFORM_SECTION_TITLE_CLASS}>Continuar no fluxo oficial</h2>
                <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
                  Abra a questão dentro da prática para responder, acompanhar estatísticas, ver materiais relacionados e registrar seu histórico.
                </p>
                <div className="mt-5 flex flex-col gap-3">
                  <Link
                    href={publicRoutes.questions.index({ questionId: question.id })}
                    onClick={(event) => {
                      event.preventDefault();
                      handleOpenPractice();
                    }}
                    aria-disabled={isCanceledQuestion}
                    className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-xs font-black uppercase tracking-[0.18em] text-white transition-all ${isCanceledQuestion ? 'cursor-not-allowed bg-red-500 opacity-80' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                  >
                    {isCanceledQuestion ? 'Questão anulada' : 'Abrir na prática'} {!isCanceledQuestion && <ArrowRight size={14} />}
                  </Link>
                  <Link
                    href="/plans"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-xs font-black uppercase tracking-[0.18em] text-slate-600 transition-all hover:border-slate-300 hover:text-slate-900 dark:border-slate-800 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:text-slate-100"
                  >
                    Ver planos
                  </Link>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </section>
    <AuthModal
      isOpen={showAuthModal}
      onClose={() => setShowAuthModal(false)}
      title="Entre para responder"
      description="Crie uma conta gratuita ou acesse sua conta para responder esta questão no fluxo oficial da prática e salvar seu progresso."
      actionSource="questao-publica"
    />
    </>
  );
};

export default QuestionPublicPage;
