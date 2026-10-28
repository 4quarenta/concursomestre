import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, BookOpenCheck, BriefcaseBusiness, Building2, CalendarDays, CheckCircle2, Download, ExternalLink, FileText, GraduationCap, MapPin } from 'lucide-react';
import CanonicalBreadcrumbs from '@/components/seo/CanonicalBreadcrumbs';
import PlatformPageHeader from '@/components/shared/layout/PlatformPageHeader';
import StructuredData from '@/components/seo/StructuredData';
import BlogConversionCta from '../BlogConversionCta';
import BlogHeader from '../BlogHeader';
import { fetchPublicExamDetailForServer, type PublicExamFile } from '../blogServerData';
import { OfficialExamProgramSection } from './officialExamProgram';
import { buildBreadcrumbList, buildStructuredDataGraph, buildWebPage } from '@services/seo/structuredData';
import { buildBoardPath } from '@services/seo';
import { publicRoutes } from '@services/routes/publicRoutes';
import { buildNoIndexMetadata } from '@/app/seoMetadata';

export type PublicExamContentProps = { params: Promise<{ slug: string }>; platformShell?: boolean };

const formatDate = (value: string | null) => {
  if (!value) return null;
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : new Intl.DateTimeFormat('pt-BR').format(date);
};

const fileIcon = (file: PublicExamFile) => file.kind === 'gabarito' ? <Download size={17} /> : <FileText size={17} />;

export async function generatePublicExamMetadata({ params }: PublicExamContentProps): Promise<Metadata> {
  const { slug } = await params;
  const exam = await fetchPublicExamDetailForServer(slug);
  if (!exam) return buildNoIndexMetadata({ title: 'Prova nÃ£o encontrada' });
  const description = `${exam.title}. Consulte informaÃ§Ãµes, arquivos oficiais e ${exam.questionCount} questÃµes vinculadas.`;
  return {
    title: exam.title,
    description,
    alternates: { canonical: publicRoutes.exams.detail(exam.slug) },
    openGraph: { title: exam.title, description, url: publicRoutes.exams.detail(exam.slug), type: 'article' },
  };
}

export default async function PublicExamContent({ params, platformShell = false }: PublicExamContentProps) {
  const { slug } = await params;
  const exam = await fetchPublicExamDetailForServer(slug);
  if (!exam) notFound();

  const dates = [
    ['InscriÃ§Ãµes', exam.registrationStart && exam.registrationEnd ? `${formatDate(exam.registrationStart)} a ${formatDate(exam.registrationEnd)}` : null],
    ['Data da prova', formatDate(exam.examDate)],
    ['Resultado', formatDate(exam.resultDate)],
  ].filter((item): item is [string, string] => Boolean(item[1]));
  const canonicalPath = publicRoutes.exams.detail(exam.slug);
  const description = `${exam.title}. Consulte informaÃ§Ãµes pÃºblicas, arquivos oficiais e questÃµes vinculadas.`;
  const pageDescription = 'Consulte os dados do concurso e os arquivos oficiais disponíveis para esta prova.';
  const cardSurfaceClass = platformShell ? 'dark:bg-slate-900' : 'dark:bg-slate-950';
  const breadcrumbs = [{ label: 'InÃ­cio', path: '/' }, { label: 'Provas', path: publicRoutes.exams.index() }, { label: exam.title, path: canonicalPath }];
  const jsonLd = buildStructuredDataGraph([
    buildWebPage({ path: canonicalPath, name: exam.title, description }),
    buildBreadcrumbList(breadcrumbs),
  ]);

  return (
    <div className={platformShell ? 'min-h-screen bg-transparent' : 'min-h-screen bg-slate-50 dark:bg-slate-900'}>
      <StructuredData value={jsonLd} />
      {!platformShell && <BlogHeader />}
      <main>
        {platformShell ? (
          <div data-practice-semantic-header data-semantic-content>
            <PlatformPageHeader breadcrumbs={breadcrumbs} title={exam.title} description={pageDescription} />
            <div className="-mt-1 mb-4 flex flex-wrap gap-2 px-3 text-xs font-black uppercase tracking-[0.08em] sm:px-4 md:px-0">
              {exam.year ? <span className="rounded-md bg-indigo-50 px-3 py-2 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200">{exam.year}</span> : null}
              <span className="rounded-md bg-slate-100 px-3 py-2 text-slate-600 dark:bg-slate-800 dark:text-slate-200">{exam.region} Â· {exam.stateName}</span>
              {exam.level ? <span className="rounded-md bg-slate-100 px-3 py-2 text-slate-600 dark:bg-slate-800 dark:text-slate-200">{exam.level}</span> : null}
            </div>
          </div>
        ) : (
          <section className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
            <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
              <CanonicalBreadcrumbs items={breadcrumbs} className="mb-5" />
              <div className="flex flex-wrap gap-2 text-xs font-black uppercase tracking-[0.08em]">
                {exam.year ? <span className="rounded-md bg-indigo-50 px-3 py-2 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200">{exam.year}</span> : null}
                <span className="rounded-md bg-slate-100 px-3 py-2 text-slate-600 dark:bg-slate-800 dark:text-slate-200">{exam.region} Â· {exam.stateName}</span>
                {exam.level ? <span className="rounded-md bg-slate-100 px-3 py-2 text-slate-600 dark:bg-slate-800 dark:text-slate-200">{exam.level}</span> : null}
              </div>
              <h1 className="mt-4 max-w-5xl text-2xl font-black leading-tight text-slate-950 dark:text-white sm:text-3xl">{exam.title}</h1>
              <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600 dark:text-slate-300">{pageDescription}</p>
            </div>
          </section>
        )}

        <section className={`mx-auto grid w-full gap-8 px-3 py-8 sm:px-4 md:px-0 lg:grid-cols-[minmax(0,1fr)_340px] ${platformShell ? '' : 'max-w-7xl lg:px-8 lg:py-10'}`}>
          <div className="space-y-8">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className={`rounded-md border border-slate-200 bg-white p-5 dark:border-slate-800 ${cardSurfaceClass}`}><BookOpenCheck className="text-indigo-600" size={20} /><strong className="mt-3 block text-2xl text-slate-950 dark:text-white">{exam.questionCount}</strong><span className="text-sm text-slate-500">QuestÃµes vinculadas</span></div>
              <div className={`rounded-md border border-slate-200 bg-white p-5 dark:border-slate-800 ${cardSurfaceClass}`}><CalendarDays className="text-indigo-600" size={20} /><strong className="mt-3 block text-2xl text-slate-950 dark:text-white">{exam.year || 'â€”'}</strong><span className="text-sm text-slate-500">Ano da prova</span></div>
              <div className={`rounded-md border border-slate-200 bg-white p-5 dark:border-slate-800 ${cardSurfaceClass}`}><GraduationCap className="text-indigo-600" size={20} /><strong className="mt-3 block text-lg text-slate-950 dark:text-white">{exam.level || 'NÃ£o informado'}</strong><span className="text-sm text-slate-500">NÃ­vel</span></div>
            </div>

            <section className={`rounded-md border border-slate-200 bg-white p-6 dark:border-slate-800 ${cardSurfaceClass}`}>
              <h2 className="text-xl font-black text-slate-950 dark:text-white">InformaÃ§Ãµes da prova</h2>
              <dl className="mt-5 grid gap-x-8 gap-y-5 sm:grid-cols-2">
                {exam.contest ? <div><dt className="text-xs font-black uppercase text-slate-400">Concurso</dt><dd className="mt-1 font-bold text-slate-800 dark:text-slate-100"><Link href={exam.contest.path} className="hover:text-indigo-600 hover:underline">{exam.contest.title}</Link></dd></div> : null}
                {exam.board ? <div><dt className="text-xs font-black uppercase text-slate-400">Banca</dt><dd className="mt-1 font-bold text-slate-800 dark:text-slate-100"><Link href={buildBoardPath(exam.board)} className="hover:text-indigo-600 hover:underline">{exam.board.name}</Link></dd></div> : null}
                {exam.organizations.length ? <div><dt className="text-xs font-black uppercase text-slate-400">Ã“rgÃ£o</dt><dd className="mt-1 flex flex-wrap gap-x-2 font-bold text-slate-800 dark:text-slate-100">{exam.organizations.map((organization) => <Link key={organization.id} href={publicRoutes.organizations.detail(organization.slug)} className="hover:text-indigo-600 hover:underline">{organization.name}</Link>)}</dd></div> : null}
                {exam.roles.length ? <div><dt className="text-xs font-black uppercase text-slate-400">Cargo</dt><dd className="mt-1 flex flex-wrap gap-x-2 font-bold text-slate-800 dark:text-slate-100">{exam.roles.map((role) => <Link key={role.id} href={publicRoutes.positions.detail(role.slug)} className="hover:text-indigo-600 hover:underline">{role.name}</Link>)}</dd></div> : null}
                {exam.careers.length ? <div><dt className="text-xs font-black uppercase text-slate-400">Carreira</dt><dd className="mt-1 flex flex-wrap gap-x-2 font-bold text-slate-800 dark:text-slate-100">{exam.careers.map((career) => <Link key={career.id} href={publicRoutes.careers.detail(career.slug)} className="hover:text-indigo-600 hover:underline">{career.name}</Link>)}</dd></div> : null}
                {exam.noticeNumber ? <div><dt className="text-xs font-black uppercase text-slate-400">Edital</dt><dd className="mt-1 font-bold text-slate-800 dark:text-slate-100">{exam.noticeNumber}</dd></div> : null}
                {exam.vacancies !== null ? <div><dt className="text-xs font-black uppercase text-slate-400">Vagas</dt><dd className="mt-1 font-bold text-slate-800 dark:text-slate-100">{exam.vacancies}</dd></div> : null}
                <div><dt className="text-xs font-black uppercase text-slate-400">Localidade</dt><dd className="mt-1 inline-flex items-center gap-1 font-bold text-slate-800 dark:text-slate-100"><MapPin size={15} /> {exam.region} Â· {exam.stateName}</dd></div>
                {dates.map(([label, value]) => <div key={label}><dt className="text-xs font-black uppercase text-slate-400">{label}</dt><dd className="mt-1 font-bold text-slate-800 dark:text-slate-100">{value}</dd></div>)}
              </dl>
            </section>

            {(() => {
              const rows = Array.isArray(exam.programmaticContentDetailed) ? exam.programmaticContentDetailed : [];
              const groups = new Map<string, { discipline: string; section: string; topics: string[] }>();
              for (const row of rows) {
                const discipline = String(row.disciplina ?? row.materia ?? '').trim();
                if (!discipline) continue;
                const section = String(row.secao ?? row.topico ?? '').trim();
                const key = `${discipline}\u0000${section}`;
                const group = groups.get(key) ?? { discipline, section, topics: [] };
                const nested = Array.isArray(row.temas) ? row.temas : [];
                const labels = nested.map((topic) => typeof topic === 'string'
                  ? topic : String(topic.rotulo_normalizado ?? topic.nome ?? topic.assunto ?? '')).filter(Boolean);
                if (!nested.length && row.assunto) labels.push(String(row.assunto));
                for (const label of labels) if (!group.topics.includes(label)) group.topics.push(label);
                groups.set(key, group);
              }
              const program = [...groups.values()];
              return program.length ? (
                <section className={`rounded-md border border-slate-200 bg-white p-6 dark:border-slate-800 ${cardSurfaceClass}`}>
                  <h2 className="text-xl font-black text-slate-950 dark:text-white">Conteúdo programático</h2>
                  {exam.programmaticContentIntegralVerificado !== true ? (
                    <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">Conteúdo estruturado a partir das fontes disponíveis; a transcrição integral do edital não foi verificada.</p>
                  ) : exam.programmaticContentFonte ? (
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Fonte: {exam.programmaticContentFonte}</p>
                  ) : null}
                  <div className="mt-4 space-y-4">
                    {program.map((item, index) => (
                      <div key={`${item.discipline}-${item.section}-${index}`}>
                        <h3 className="font-bold text-slate-800 dark:text-slate-100">{item.discipline}</h3>
                        {item.section ? <p className="mt-1 text-sm font-semibold text-slate-600 dark:text-slate-300">{item.section}</p> : null}
                        {item.topics.length ? <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-300">{item.topics.map((topic, topicIndex) => <li key={`${topicIndex}-${topic}`}>{topic}</li>)}</ul> : null}
                      </div>
                    ))}
                  </div>
                </section>
              ) : <OfficialExamProgramSection slug={exam.slug} platformShell={platformShell} />;
            })()}

            {(exam.subjects.length || exam.areas.length) ? (
              <section className={`rounded-md border border-slate-200 bg-white p-6 dark:border-slate-800 ${cardSurfaceClass}`}>
                <h2 className="text-xl font-black text-slate-950 dark:text-white">ConteÃºdo relacionado</h2>
                <div className="mt-4 flex flex-wrap gap-2">{[...exam.subjects, ...exam.areas].map((item) => <span key={`${item.id}-${item.slug}`} className="rounded-md bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{item.name}</span>)}</div>
              </section>
            ) : null}
          </div>

          <aside className="space-y-5 self-start lg:sticky lg:top-6">
            <section className={`rounded-md border border-slate-200 bg-white p-6 dark:border-slate-800 ${cardSurfaceClass}`}>
              <h2 className="text-lg font-black text-slate-950 dark:text-white">Arquivos oficiais</h2>
              {exam.files.length ? <div className="mt-4 space-y-2">{exam.files.map((file) => <a key={file.id} href={file.url} target="_blank" rel="noreferrer" className="flex min-h-11 items-center justify-between gap-3 rounded-md border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:border-indigo-400 hover:text-indigo-600 dark:border-slate-700 dark:text-slate-200"><span className="inline-flex items-center gap-2">{fileIcon(file)} {file.label}</span><ExternalLink size={15} /></a>)}</div> : <p className="mt-3 text-sm text-slate-500">Nenhum arquivo pÃºblico disponÃ­vel.</p>}
              {exam.officialUrl ? <a href={exam.officialUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-indigo-600 hover:underline">PÃ¡gina oficial <ExternalLink size={15} /></a> : null}
            </section>
            <section className="rounded-md bg-slate-950 p-6 text-white dark:bg-white dark:text-slate-950">
              <Building2 size={22} />
              <h2 className="mt-3 text-xl font-black">Prepare-se com questÃµes</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300 dark:text-slate-600">Use os filtros da plataforma para praticar conteÃºdos desta banca, Ã³rgÃ£o e carreira.</p>
              <Link href={publicRoutes.questions.index()} className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 text-sm font-black text-white hover:bg-indigo-500"><BriefcaseBusiness size={17} /> Ir para questÃµes</Link>
            </section>
          </aside>
        </section>
        {exam.relatedExams.length > 0 ? (
          <section className={platformShell ? 'py-6' : 'border-y border-slate-200 bg-white py-10 dark:border-slate-800 dark:bg-slate-950'}>
            <div className={platformShell ? 'w-full px-3 sm:px-4 md:px-0' : 'mx-auto max-w-7xl px-5 lg:px-8'}>
              <div className="flex flex-col justify-between gap-4 border-b border-slate-300 pb-5 sm:flex-row sm:items-end dark:border-slate-700">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-indigo-600">Continue praticando</p>
                  <h2 className="mt-1 text-2xl font-black text-slate-950 dark:text-white">Outras provas relacionadas</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                    Selecionadas por banca, Ã³rgÃ£o, cargo, carreira, disciplina e proximidade de ano.
                  </p>
                </div>
                <Link href={publicRoutes.exams.index()} className="inline-flex items-center gap-1 text-sm font-bold text-indigo-600 hover:underline">
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
                          <Link href={publicRoutes.exams.detail(relatedExam.slug)} className="hover:text-indigo-600">{relatedExam.title}</Link>
                        </h3>
                      </div>
                      {relatedExam.year ? <span className="shrink-0 rounded-md bg-slate-200 px-2 py-1 text-xs font-black text-slate-700 dark:bg-slate-800 dark:text-slate-200">{relatedExam.year}</span> : null}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1"><MapPin size={13} /> {relatedExam.region} Â· {relatedExam.stateName}</span>
                      <span className="inline-flex items-center gap-1"><CheckCircle2 size={13} /> {relatedExam.questionCount} questÃµes</span>
                    </div>
                    <Link href={publicRoutes.exams.detail(relatedExam.slug)} className="mt-auto inline-flex items-center gap-1 pt-5 text-sm font-black text-indigo-600 hover:underline">
                      Ver prova <ArrowRight size={14} />
                    </Link>
                  </article>
                ))}
              </div>
            </div>
          </section>
        ) : null}
        {!platformShell && <BlogConversionCta />}
      </main>
    </div>
  );
}
