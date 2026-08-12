import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, BookOpenCheck, BriefcaseBusiness, Building2, CalendarDays, CheckCircle2, Download, ExternalLink, FileText, GraduationCap, MapPin } from 'lucide-react';
import { buildSiteUrl } from '@/config/siteUrl';
import BlogConversionCta from '../../BlogConversionCta';
import BlogHeader from '../../BlogHeader';
import { fetchPublicExamDetailForServer, type PublicExamFile, type PublicExamTaxonomy } from '../../blogServerData';
import { serializeStructuredData } from '@services/seo/structuredData';
import { buildBoardPath } from '@services/seo';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type PublicExamPageProps = { params: Promise<{ slug: string }> };

const formatDate = (value: string | null) => {
  if (!value) return null;
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : new Intl.DateTimeFormat('pt-BR').format(date);
};

const names = (items: PublicExamTaxonomy[]) => items.map((item) => item.name).filter(Boolean).join(' / ');
const fileIcon = (file: PublicExamFile) => file.kind === 'gabarito' ? <Download size={17} /> : <FileText size={17} />;

export async function generateMetadata({ params }: PublicExamPageProps): Promise<Metadata> {
  const { slug } = await params;
  const exam = await fetchPublicExamDetailForServer(slug);
  if (!exam) return { title: 'Prova não encontrada' };
  const description = `${exam.title}. Consulte informações, arquivos oficiais e ${exam.questionCount} questões vinculadas.`;
  return {
    title: exam.title,
    description,
    alternates: { canonical: `/blog/provas/${exam.slug}` },
    openGraph: { title: exam.title, description, url: `/blog/provas/${exam.slug}`, type: 'article' },
  };
}

export default async function PublicExamPage({ params }: PublicExamPageProps) {
  const { slug } = await params;
  const exam = await fetchPublicExamDetailForServer(slug);
  if (!exam) notFound();

  const dates = [
    ['Inscrições', exam.registrationStart && exam.registrationEnd ? `${formatDate(exam.registrationStart)} a ${formatDate(exam.registrationEnd)}` : null],
    ['Data da prova', formatDate(exam.examDate)],
    ['Resultado', formatDate(exam.resultDate)],
  ].filter((item): item is [string, string] => Boolean(item[1]));
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LearningResource',
    name: exam.title,
    url: buildSiteUrl(`/blog/provas/${exam.slug}`),
    inLanguage: 'pt-BR',
    educationalLevel: exam.level || undefined,
    provider: { '@type': 'Organization', name: exam.board?.name || 'ConcursoMestre' },
    hasPart: exam.files.map((file) => ({ '@type': 'MediaObject', name: file.name, contentUrl: buildSiteUrl(file.url) })),
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeStructuredData(jsonLd) }} />
      <BlogHeader />
      <main>
        <section className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
            <Link href="/blog/provas" className="inline-flex items-center gap-1 text-sm font-bold text-indigo-600 hover:underline"><ArrowLeft size={16} /> Acervo de provas</Link>
            <div className="mt-5 flex flex-wrap gap-2 text-xs font-black uppercase tracking-[0.08em]">
              {exam.year ? <span className="rounded-md bg-indigo-50 px-3 py-2 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200">{exam.year}</span> : null}
              <span className="rounded-md bg-slate-100 px-3 py-2 text-slate-600 dark:bg-slate-800 dark:text-slate-200">{exam.region} · {exam.stateName}</span>
              {exam.level ? <span className="rounded-md bg-slate-100 px-3 py-2 text-slate-600 dark:bg-slate-800 dark:text-slate-200">{exam.level}</span> : null}
            </div>
            <h1 className="mt-4 max-w-5xl text-3xl font-black leading-tight text-slate-950 dark:text-white lg:text-5xl">{exam.title}</h1>
            {exam.officialTitle && exam.officialTitle !== exam.title ? <p className="mt-4 max-w-4xl text-base leading-7 text-slate-600 dark:text-slate-300">{exam.officialTitle}</p> : null}
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-8 px-5 py-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:px-8">
          <div className="space-y-8">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950"><BookOpenCheck className="text-indigo-600" size={20} /><strong className="mt-3 block text-2xl text-slate-950 dark:text-white">{exam.questionCount}</strong><span className="text-sm text-slate-500">Questões vinculadas</span></div>
              <div className="rounded-md border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950"><CalendarDays className="text-indigo-600" size={20} /><strong className="mt-3 block text-2xl text-slate-950 dark:text-white">{exam.year || '—'}</strong><span className="text-sm text-slate-500">Ano da prova</span></div>
              <div className="rounded-md border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950"><GraduationCap className="text-indigo-600" size={20} /><strong className="mt-3 block text-lg text-slate-950 dark:text-white">{exam.level || 'Não informado'}</strong><span className="text-sm text-slate-500">Nível</span></div>
            </div>

            <section className="rounded-md border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-950">
              <h2 className="text-xl font-black text-slate-950 dark:text-white">Informações da prova</h2>
              <dl className="mt-5 grid gap-x-8 gap-y-5 sm:grid-cols-2">
                {exam.board ? <div><dt className="text-xs font-black uppercase text-slate-400">Banca</dt><dd className="mt-1 font-bold text-slate-800 dark:text-slate-100"><Link href={buildBoardPath(exam.board)} className="hover:text-indigo-600 hover:underline">{exam.board.name}</Link></dd></div> : null}
                {exam.organizations.length ? <div><dt className="text-xs font-black uppercase text-slate-400">Órgão</dt><dd className="mt-1 font-bold text-slate-800 dark:text-slate-100">{names(exam.organizations)}</dd></div> : null}
                {exam.roles.length ? <div><dt className="text-xs font-black uppercase text-slate-400">Cargo</dt><dd className="mt-1 font-bold text-slate-800 dark:text-slate-100">{names(exam.roles)}</dd></div> : null}
                {exam.careers.length ? <div><dt className="text-xs font-black uppercase text-slate-400">Carreira</dt><dd className="mt-1 font-bold text-slate-800 dark:text-slate-100">{names(exam.careers)}</dd></div> : null}
                {exam.noticeNumber ? <div><dt className="text-xs font-black uppercase text-slate-400">Edital</dt><dd className="mt-1 font-bold text-slate-800 dark:text-slate-100">{exam.noticeNumber}</dd></div> : null}
                {exam.vacancies !== null ? <div><dt className="text-xs font-black uppercase text-slate-400">Vagas</dt><dd className="mt-1 font-bold text-slate-800 dark:text-slate-100">{exam.vacancies}</dd></div> : null}
                <div><dt className="text-xs font-black uppercase text-slate-400">Localidade</dt><dd className="mt-1 inline-flex items-center gap-1 font-bold text-slate-800 dark:text-slate-100"><MapPin size={15} /> {exam.region} · {exam.stateName}</dd></div>
                {dates.map(([label, value]) => <div key={label}><dt className="text-xs font-black uppercase text-slate-400">{label}</dt><dd className="mt-1 font-bold text-slate-800 dark:text-slate-100">{value}</dd></div>)}
              </dl>
            </section>

            {(exam.subjects.length || exam.areas.length) ? (
              <section className="rounded-md border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-950">
                <h2 className="text-xl font-black text-slate-950 dark:text-white">Conteúdo relacionado</h2>
                <div className="mt-4 flex flex-wrap gap-2">{[...exam.subjects, ...exam.areas].map((item) => <span key={`${item.id}-${item.slug}`} className="rounded-md bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{item.name}</span>)}</div>
              </section>
            ) : null}
          </div>

          <aside className="space-y-5 self-start lg:sticky lg:top-6">
            <section className="rounded-md border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-950">
              <h2 className="text-lg font-black text-slate-950 dark:text-white">Arquivos oficiais</h2>
              {exam.files.length ? <div className="mt-4 space-y-2">{exam.files.map((file) => <a key={file.id} href={file.url} target="_blank" rel="noreferrer" className="flex min-h-11 items-center justify-between gap-3 rounded-md border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:border-indigo-400 hover:text-indigo-600 dark:border-slate-700 dark:text-slate-200"><span className="inline-flex items-center gap-2">{fileIcon(file)} {file.label}</span><ExternalLink size={15} /></a>)}</div> : <p className="mt-3 text-sm text-slate-500">Nenhum arquivo público disponível.</p>}
              {exam.officialUrl ? <a href={exam.officialUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-indigo-600 hover:underline">Página oficial <ExternalLink size={15} /></a> : null}
            </section>
            <section className="rounded-md bg-slate-950 p-6 text-white dark:bg-white dark:text-slate-950">
              <Building2 size={22} />
              <h2 className="mt-3 text-xl font-black">Prepare-se com questões</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300 dark:text-slate-600">Use os filtros da plataforma para praticar conteúdos desta banca, órgão e carreira.</p>
              <Link href="/practice" className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 text-sm font-black text-white hover:bg-indigo-500"><BriefcaseBusiness size={17} /> Ir para questões</Link>
            </section>
          </aside>
        </section>
        {exam.relatedExams.length > 0 ? (
          <section className="border-y border-slate-200 bg-white py-10 dark:border-slate-800 dark:bg-slate-950">
            <div className="mx-auto max-w-7xl px-5 lg:px-8">
              <div className="flex flex-col justify-between gap-4 border-b border-slate-300 pb-5 sm:flex-row sm:items-end dark:border-slate-700">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-indigo-600">Continue praticando</p>
                  <h2 className="mt-1 text-2xl font-black text-slate-950 dark:text-white">Outras provas relacionadas</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                    Selecionadas por banca, órgão, cargo, carreira, disciplina e proximidade de ano.
                  </p>
                </div>
                <Link href="/blog/provas" className="inline-flex items-center gap-1 text-sm font-bold text-indigo-600 hover:underline">
                  Ver acervo completo <ArrowRight size={15} />
                </Link>
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {exam.relatedExams.map((relatedExam) => (
                  <article key={relatedExam.id} className="flex min-h-52 flex-col rounded-md border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        {relatedExam.board ? (
                          <Link href={buildBoardPath({ slug: relatedExam.boardSlug, name: relatedExam.board })} prefetch={false} className="text-[11px] font-black uppercase tracking-[0.12em] text-indigo-600 hover:underline">
                            {relatedExam.board}
                          </Link>
                        ) : null}
                        <h3 className="mt-2 line-clamp-3 text-base font-black leading-6 text-slate-950 dark:text-white">
                          <Link href={`/blog/provas/${relatedExam.slug}`} className="hover:text-indigo-600">{relatedExam.title}</Link>
                        </h3>
                      </div>
                      {relatedExam.year ? <span className="shrink-0 rounded-md bg-slate-200 px-2 py-1 text-xs font-black text-slate-700 dark:bg-slate-800 dark:text-slate-200">{relatedExam.year}</span> : null}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1"><MapPin size={13} /> {relatedExam.region} · {relatedExam.stateName}</span>
                      <span className="inline-flex items-center gap-1"><CheckCircle2 size={13} /> {relatedExam.questionCount} questões</span>
                    </div>
                    <Link href={`/blog/provas/${relatedExam.slug}`} className="mt-auto inline-flex items-center gap-1 pt-5 text-sm font-black text-indigo-600 hover:underline">
                      Ver prova <ArrowRight size={14} />
                    </Link>
                  </article>
                ))}
              </div>
            </div>
          </section>
        ) : null}
        <BlogConversionCta />
      </main>
    </div>
  );
}
