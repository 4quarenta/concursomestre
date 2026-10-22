import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowRight, BookOpen, Building2, FileText, Landmark, Newspaper, Search, Shapes, Trophy, type LucideIcon } from 'lucide-react';
import PlatformPageHeader from '@/components/shared/layout/PlatformPageHeader';
import { buildQuestionPath, summarizeSeoText } from '@services/seo';
import { publicRoutes } from '@services/routes/publicRoutes';
import type { GlobalSearchGroup, GlobalSearchResults as GlobalSearchData } from './globalSearchServerData';

const countLabel = (count: number) => `${count.toLocaleString('pt-BR')} ${count === 1 ? 'resultado' : 'resultados'}`;

function ResultSection({
  id,
  title,
  icon: Icon,
  group,
  moreHref,
  children,
}: {
  id: string;
  title: string;
  icon: LucideIcon;
  group: GlobalSearchGroup<unknown>;
  moreHref?: string;
  children: ReactNode;
}) {
  if (group.total === 0) return null;
  return (
    <section id={id} className="border-b border-slate-200 py-5 last:border-b-0 dark:border-slate-800" aria-labelledby={`${id}-title`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id={`${id}-title`} className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-100">
          <Icon size={17} className="text-indigo-600 dark:text-indigo-400" /> {title}
          <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{countLabel(group.total)}</span>
        </h2>
        {moreHref ? <Link href={moreHref} className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:underline dark:text-indigo-400">Ver acervo <ArrowRight size={14} /></Link> : null}
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-800">{children}</div>
    </section>
  );
}

function TextResult({ href, title, description, meta }: { href: string; title: string; description?: string | null; meta?: string }) {
  return (
    <article className="py-3 first:pt-0 last:pb-0">
      <Link href={href} className="font-semibold leading-6 text-slate-800 hover:text-indigo-600 dark:text-slate-100 dark:hover:text-indigo-300">{title}</Link>
      {description ? <p className="mt-1 max-w-4xl text-sm leading-5 text-slate-600 dark:text-slate-300">{summarizeSeoText(description, 180)}</p> : null}
      {meta ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{meta}</p> : null}
    </article>
  );
}

export default function GlobalSearchResults({ query, results }: { query: string; results: GlobalSearchData }) {
  const questionMore = publicRoutes.questions.index({ keyword: query });
  const examMore = publicRoutes.exams.index({ busca: query });
  const blogMore = publicRoutes.blog.index({ q: query });
  const subjectMore = publicRoutes.disciplines.index({ busca: query });
  const boardMore = publicRoutes.boards.index({ busca: query });
  const organizationMore = publicRoutes.organizations.index({ busca: query });
  const contestMore = publicRoutes.contests.index({ busca: query });
  const materialMore = publicRoutes.materials.index({ busca: query });
  const simulationMore = publicRoutes.simulations.index({ busca: query });
  const total = Object.values(results).reduce((sum, group) => sum + group.total, 0);

  return (
    <div className="space-y-4">
      <PlatformPageHeader
        breadcrumbs={[{ label: 'Início', path: '/' }, { label: 'Busca', path: publicRoutes.search.index({ q: query }) }]}
        title="Busca no ConcursoMestre"
        description={`Resultados de questões, provas, notícias, assuntos e outros conteúdos para “${query}”.`}
      />

      <form action={publicRoutes.search.index()} method="get" role="search" className="flex flex-col gap-2 sm:flex-row">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Buscar em todo o ConcursoMestre</span>
          <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input name="q" defaultValue={query} maxLength={120} autoComplete="off" placeholder="Buscar questões, provas, notícias e assuntos" className="h-11 w-full rounded-md border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-900 outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
        </label>
        <button type="submit" className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-700"><Search size={16} /> Buscar</button>
      </form>

      <p className="text-sm text-slate-500 dark:text-slate-400">{countLabel(total)} em todo o acervo</p>

      {total === 0 ? (
        <div className="border-y border-slate-200 py-10 text-center dark:border-slate-800">
          <Search size={24} className="mx-auto text-slate-400" />
          <h2 className="mt-3 font-semibold text-slate-900 dark:text-slate-100">Nenhum resultado encontrado</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{query ? 'Tente outro termo ou use menos palavras.' : 'Digite um termo para pesquisar em todo o acervo.'}</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-200 border-y border-slate-200 dark:divide-slate-800 dark:border-slate-800">
          <ResultSection id="questoes" title="Questões" icon={BookOpen} group={results.questions} moreHref={questionMore}>
            {results.questions.items.map((question) => (
              <TextResult key={String(question.id)} href={buildQuestionPath(question)} title={summarizeSeoText(question.enunciado_clean || question.enunciado || `Questão ${question.id}`, 190)} meta={`Questão ${question.id}`} />
            ))}
          </ResultSection>
          <ResultSection id="provas" title="Provas" icon={FileText} group={results.exams} moreHref={examMore}>
            {results.exams.items.map((exam) => <TextResult key={exam.id} href={publicRoutes.exams.detail(exam.slug)} title={exam.title} meta={[exam.year, exam.board, `${exam.questionCount} questões`].filter(Boolean).join(' · ')} />)}
          </ResultSection>
          <ResultSection id="noticias" title="Notícias e artigos" icon={Newspaper} group={results.news} moreHref={blogMore}>
            {results.news.items.map((article) => <TextResult key={article.id} href={publicRoutes.blog.article(article.slug)} title={article.title} description={article.excerpt} meta={article.taxonomy.category.label} />)}
          </ResultSection>
          <ResultSection id="assuntos" title="Disciplinas e assuntos" icon={Shapes} group={{ items: [...results.subjects.items, ...results.topics.items], total: results.subjects.total + results.topics.total }} moreHref={subjectMore}>
            {[
              ...results.subjects.items.map((item) => ({ item, type: 'subject' as const })),
              ...results.topics.items.map((item) => ({ item, type: 'topic' as const })),
            ].map(({ item, type }) => <TextResult key={`${type}-${item.id}`} href={type === 'subject' ? publicRoutes.disciplines.detail(item.slug) : publicRoutes.topics.detail(item.slug)} title={item.name} description={item.description} meta={type === 'subject' ? 'Disciplina' : 'Assunto'} />)}
          </ResultSection>
          <ResultSection id="bancas" title="Bancas" icon={Landmark} group={results.boards} moreHref={boardMore}>
            {results.boards.items.map((item) => <TextResult key={item.id} href={publicRoutes.boards.detail(item.slug)} title={item.name} description={item.description} meta={`${item.questionCount.toLocaleString('pt-BR')} questões · ${item.examCount.toLocaleString('pt-BR')} provas`} />)}
          </ResultSection>
          <ResultSection id="orgaos" title="Órgãos" icon={Building2} group={results.organizations} moreHref={organizationMore}>
            {results.organizations.items.map((item) => <TextResult key={item.id} href={publicRoutes.organizations.detail(item.slug)} title={item.name} description={item.description} />)}
          </ResultSection>
          <ResultSection id="concursos" title="Concursos" icon={Trophy} group={results.contests} moreHref={contestMore}>
            {results.contests.items.map((contest) => <TextResult key={contest.id} href={contest.path} title={contest.title} description={contest.description} meta={[contest.year, contest.organization, contest.board].filter(Boolean).join(' · ')} />)}
          </ResultSection>
          <ResultSection id="materiais" title="Materiais" icon={FileText} group={results.materials} moreHref={materialMore}>
            {results.materials.items.map((material) => <TextResult key={material.id} href={material.path} title={material.title} description={material.description} meta={[material.format, material.year].filter(Boolean).join(' · ')} />)}
          </ResultSection>
          <ResultSection id="simulados" title="Simulados" icon={Shapes} group={results.simulations} moreHref={simulationMore}>
            {results.simulations.items.map((simulation) => <TextResult key={simulation.id} href={simulation.path} title={simulation.title} description={simulation.description} meta={`${simulation.questionCount} questões${simulation.durationMinutes ? ` · ${simulation.durationMinutes} min` : ''}`} />)}
          </ResultSection>
        </div>
      )}
    </div>
  );
}
