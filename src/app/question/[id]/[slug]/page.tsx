import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowRight, Building2, Calendar, FileQuestion, GraduationCap, ShieldCheck, Tag } from 'lucide-react';
import { buildQuestionMetadata, loadPublicQuestionById } from '@/lib/publicQuestions';
import { buildQuestionStructuredData, serializeStructuredData } from '@/lib/structuredData';
import { normalizeQuestionRichHtml } from '@/services/questions/questionHtmlSanitizer';
import { buildQuestionPath, buildQuestionSlug, getQuestionSeoLabel, summarizeSeoText } from '@/services/seo/slug';

const optionLetters = ['A', 'B', 'C', 'D', 'E', 'F'];
export const revalidate = 3600;

interface QuestionPageProps {
  params: Promise<{ id: string; slug: string }>;
}

const resolveCargoLabel = (cargo: { descricao?: string; descrição?: string; name?: string }) =>
  cargo.descricao || cargo.descrição || cargo.name || '';

export async function generateMetadata({ params }: QuestionPageProps): Promise<Metadata> {
  const { id } = await params;
  const question = await loadPublicQuestionById(id);

  if (!question) {
    return {
      title: 'Questao nao encontrada | ConcursoMestre',
      robots: { index: false, follow: false },
    };
  }

  return buildQuestionMetadata(question);
}

export default async function QuestionPage({ params }: QuestionPageProps) {
  const { id, slug } = await params;
  const question = await loadPublicQuestionById(id);

  if (!question) {
    notFound();
  }

  const canonicalPath = buildQuestionPath(question);
  const canonicalSlug = buildQuestionSlug(question);
  if (slug !== canonicalSlug) {
    redirect(canonicalPath);
  }

  const metadataItems = [
    { label: 'Banca', value: question.bancas?.map((item) => item.sigla || item.nome).filter(Boolean).join(', ') },
    { label: 'Orgao', value: question.orgaos?.map((item) => item.sigla || item.nome).filter(Boolean).join(', ') },
    { label: 'Cargo', value: question.cargos?.map((item) => resolveCargoLabel(item)).filter(Boolean).join(', ') },
    { label: 'Ano', value: question.anos?.join(', ') },
    { label: 'Assuntos', value: question.assuntos?.map((item) => item.nome).filter(Boolean).join(', ') },
  ].filter((item) => item.value);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeStructuredData(buildQuestionStructuredData(question)) }}
      />
      <section className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 bg-gradient-to-br from-indigo-50 via-white to-sky-50 p-4 sm:p-5 md:p-6 dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">Questao publica</p>
          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100 md:text-5xl">
                {summarizeSeoText(getQuestionSeoLabel(question), 110)}
              </h1>
              <p className="max-w-3xl text-sm font-medium leading-7 text-slate-500 dark:text-slate-400 md:text-base">
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
            <article className="space-y-6 rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5 md:p-6">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                <FileQuestion size={14} />
                Questao #{question.id}
              </div>
              <div
                className="prose prose-slate max-w-none text-sm leading-7 dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: normalizeQuestionRichHtml(question.enunciado || question.enunciado_clean || '') }}
              />

              {Array.isArray(question.itens) && question.itens.length > 0 && (
                <div className="space-y-3">
                  <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-slate-100">Alternativas</h2>
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
              )}
            </article>

            <aside className="space-y-4">
              <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-slate-100">Resumo rapido</h2>
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

              <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-slate-100">Continuar no fluxo oficial</h2>
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
                    href="/planos"
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
    </>
  );
}
