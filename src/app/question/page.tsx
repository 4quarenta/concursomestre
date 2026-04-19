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
import { ArrowRight, Building2, Calendar, FileQuestion, GraduationCap, Loader2, ShieldCheck, Tag } from 'lucide-react';
import type { Question } from '@types';
import { questionService } from '@services/questions';
import { normalizeQuestionRichHtml } from '@services/questions/questionHtmlSanitizer';
import {
  PLATFORM_MAIN_CONTENT_WIDTH_CLASS,
  PLATFORM_PAGE_DESCRIPTION_CLASS,
  PLATFORM_PAGE_TITLE_CLASS,
  PLATFORM_SECTION_TITLE_CLASS,
  PLATFORM_SURFACE_CARD_CLASS,
} from '@constants/layout';
import { buildAbsoluteUrl, buildQuestionPath, buildQuestionSlug, getQuestionSeoLabel, summarizeSeoText, useDocumentSeo } from '@services/seo';

const optionLetters = ['A', 'B', 'C', 'D', 'E', 'F'];

const QuestionPublicPage: React.FC = () => {
  const { id, slug } = useParams<{ id: string; slug?: string }>();
  const router = useRouter();
  const [question, setQuestion] = React.useState<Question | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!id) {
      setError('Questao nao encontrada.');
      setIsLoading(false);
      return;
    }

    let isMounted = true;
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

        setError(requestError instanceof Error ? requestError.message : 'Nao foi possivel carregar a questao.');
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [id]);

  const canonicalPath = React.useMemo(() => {
    if (!question?.id) {
      return null;
    }

    return buildQuestionPath(question);
  }, [question]);

  React.useEffect(() => {
    if (!question?.id || !canonicalPath) {
      return;
    }

    const canonicalSlug = buildQuestionSlug(question);
    if (slug !== canonicalSlug) {
      router.replace(canonicalPath);
    }
  }, [canonicalPath, question, router, slug]);

  useDocumentSeo(question ? {
    title: `${summarizeSeoText(getQuestionSeoLabel(question), 60)} | ConcursoMestre`,
    description: summarizeSeoText(getQuestionSeoLabel(question), 160),
    canonical: buildAbsoluteUrl(canonicalPath || `/question/${question.id}`),
    ogTitle: summarizeSeoText(getQuestionSeoLabel(question), 95),
    ogDescription: summarizeSeoText(getQuestionSeoLabel(question), 180),
  } : null);

  const metadataItems = [
    { label: 'Banca', value: question?.bancas?.map((item) => item.sigla || item.nome).filter(Boolean).join(', ') },
    { label: 'Orgao', value: question?.orgaos?.map((item) => item.sigla || item.nome).filter(Boolean).join(', ') },
    { label: 'Cargo', value: question?.cargos?.map((item: any) => item.descricao || item['descrição'] || item.name).filter(Boolean).join(', ') },
    { label: 'Ano', value: question?.anos?.join(', ') },
    { label: 'Assuntos', value: question?.assuntos?.map((item) => item.nome).filter(Boolean).join(', ') },
  ].filter((item) => item.value);

  if (isLoading) {
    return (
      <section className={`mx-auto w-full ${PLATFORM_MAIN_CONTENT_WIDTH_CLASS} px-4 py-8 sm:px-6 lg:px-8`}>
        <div className={`${PLATFORM_SURFACE_CARD_CLASS} flex min-h-[320px] items-center justify-center p-8`}>
          <div className="flex items-center gap-3 text-sm font-bold text-slate-500 dark:text-slate-400">
            <Loader2 size={18} className="animate-spin text-indigo-600" />
            Carregando questao publica...
          </div>
        </div>
      </section>
    );
  }

  if (error || !question) {
    return (
      <section className={`mx-auto w-full ${PLATFORM_MAIN_CONTENT_WIDTH_CLASS} px-4 py-8 sm:px-6 lg:px-8`}>
        <div className={`${PLATFORM_SURFACE_CARD_CLASS} space-y-4 p-8`}>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-rose-600">Questao indisponivel</p>
          <h1 className={PLATFORM_PAGE_TITLE_CLASS}>Nao foi possivel abrir esta questao</h1>
          <p className={PLATFORM_PAGE_DESCRIPTION_CLASS}>{error || 'A questao solicitada nao esta disponivel no momento.'}</p>
          <Link
            href="/practice"
            className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-white transition-all hover:bg-indigo-700"
          >
            Ir para a pratica <ArrowRight size={14} />
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className={`mx-auto w-full ${PLATFORM_MAIN_CONTENT_WIDTH_CLASS} space-y-6 px-4 py-8 sm:px-6 lg:px-8`}>
      <div className={`${PLATFORM_SURFACE_CARD_CLASS} overflow-hidden`}>
        <div className="border-b border-slate-200 bg-gradient-to-br from-indigo-50 via-white to-sky-50 p-4 sm:p-5 md:p-6 dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">Questao publica</p>
          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <h1 className={PLATFORM_PAGE_TITLE_CLASS}>{summarizeSeoText(getQuestionSeoLabel(question), 110)}</h1>
              <p className={PLATFORM_PAGE_DESCRIPTION_CLASS}>
                Esta pagina publica ajuda a indexar o enunciado da questao. Para responder, salvar historico e ver sua evolucao, use o fluxo oficial de pratica.
              </p>
            </div>
            <Link
              href={`/practice?questionId=${question.id}`}
              className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-white transition-all hover:bg-indigo-700"
            >
              Resolver na pratica <ArrowRight size={14} />
            </Link>
          </div>
        </div>

        <div className="space-y-6 p-4 sm:p-5 md:p-6">
          {metadataItems.length > 0 && (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {metadataItems.map((item) => (
                <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">{item.label}</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{item.value}</p>
                </div>
              ))}
            </div>
          )}

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr),360px]">
            <article className="space-y-6 rounded-[2rem] border border-slate-200 bg-white p-4 sm:p-5 md:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                <FileQuestion size={14} />
                Questao #{question.id}
              </div>
              <div
                className="prose prose-slate max-w-none text-sm leading-7 dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: normalizeQuestionRichHtml(question.enunciado || question.enunciado_clean || '') }}
              />

              {Array.isArray(question.itens) && question.itens.length > 0 ? (
                <div className="space-y-3">
                  <h2 className={PLATFORM_SECTION_TITLE_CLASS}>Alternativas</h2>
                  {question.itens.map((item, index) => (
                    <div key={`${item.id}-${item.ordem}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
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
                <h2 className={PLATFORM_SECTION_TITLE_CLASS}>Resumo rapido</h2>
                <div className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={16} className="text-emerald-600 dark:text-emerald-300" />
                    <span>{question.commentsCount || 0} comentarios na comunidade</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar size={16} className="text-sky-600 dark:text-sky-300" />
                    <span>{question.anos?.length ? question.anos.join(', ') : 'Ano nao informado'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Building2 size={16} className="text-indigo-600 dark:text-indigo-300" />
                    <span>{question.bancas?.[0]?.sigla || question.bancas?.[0]?.nome || 'Banca nao informada'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <GraduationCap size={16} className="text-amber-600 dark:text-amber-300" />
                    <span>Dificuldade {question.dificuldade}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Tag size={16} className="text-fuchsia-600 dark:text-fuchsia-300" />
                    <span>{question.tipo === 'certo ou errado' ? 'Certo ou errado' : 'Multipla escolha'}</span>
                  </div>
                </div>
              </div>

              <div className={`${PLATFORM_SURFACE_CARD_CLASS} p-5`}>
                <h2 className={PLATFORM_SECTION_TITLE_CLASS}>Continuar no fluxo oficial</h2>
                <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
                  Abra a questao dentro da pratica para responder, acompanhar estatisticas, ver materiais relacionados e registrar seu historico.
                </p>
                <div className="mt-5 flex flex-col gap-3">
                  <Link
                    href={`/practice?questionId=${question.id}`}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-xs font-black uppercase tracking-[0.18em] text-white transition-all hover:bg-indigo-700"
                  >
                    Abrir na pratica <ArrowRight size={14} />
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
  );
};

export default QuestionPublicPage;
