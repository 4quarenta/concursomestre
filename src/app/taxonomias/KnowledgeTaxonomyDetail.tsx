import Link from 'next/link';
import { ArrowRight, BookOpen, ChevronRight, FileQuestion, FileText, Landmark, ListChecks } from 'lucide-react';
import CanonicalBreadcrumbs from '@/components/seo/CanonicalBreadcrumbs';
import StructuredData from '@/components/seo/StructuredData';
import { PLATFORM_PAGE_DESCRIPTION_CLASS, PLATFORM_PAGE_TITLE_CLASS, PLATFORM_SURFACE_CARD_CLASS } from '@constants/layout';
import { buildBreadcrumbList, buildItemList, buildStructuredDataGraph, buildWebPage } from '@services/seo/structuredData';
import { knowledgeTaxonomyDescription } from './knowledgeTaxonomyMetadata';
import type { PublicKnowledgeTaxonomy } from './knowledgeTaxonomyServerData';

const labels = { materia: 'Disciplina', topico: 'Tópico', assunto: 'Assunto' } as const;

export default function KnowledgeTaxonomyDetail({ taxonomy }: { taxonomy: PublicKnowledgeTaxonomy }) {
  const breadcrumbs = taxonomy.breadcrumbs.map((item) => ({ label: item.label, path: item.canonicalPath }));
  const questionItems = buildItemList(taxonomy.questions.map((question) => ({
    name: question.excerpt || `Questão ${question.id}`,
    path: question.path,
  })));
  const structuredData = buildStructuredDataGraph([
    buildWebPage({ path: taxonomy.canonicalPath, name: `Questões de ${taxonomy.name}`, description: knowledgeTaxonomyDescription(taxonomy) }),
    buildBreadcrumbList(breadcrumbs),
    ...(taxonomy.questions.length ? [questionItems] : []),
  ]);
  const directSubjects = taxonomy.subjects.filter((item) => !item.subtopicId);

  return (
    <article data-semantic-content className="w-full animate-fade-in space-y-5">
      <StructuredData value={structuredData} />
      <CanonicalBreadcrumbs items={breadcrumbs} />

      <header className={`${PLATFORM_SURFACE_CARD_CLASS} p-5 sm:p-6`}>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-700 dark:text-indigo-300">{labels[taxonomy.taxonomyLevel]}</p>
        <h1 className={`mt-2 ${PLATFORM_PAGE_TITLE_CLASS}`}>Questões de {taxonomy.name}</h1>
        <p className={`mt-3 max-w-4xl ${PLATFORM_PAGE_DESCRIPTION_CLASS}`}>{knowledgeTaxonomyDescription(taxonomy)}</p>
        {taxonomy.subtopic ? <p className="mt-2 text-xs font-bold text-slate-500">Subtópico: {taxonomy.subtopic.name}</p> : null}
        {taxonomy.readiness.status === 'NOT_READY' ? <p className="mt-3 text-xs text-slate-500">Esta taxonomia está em revisão estrutural e ainda não participa da publicação SEO.</p> : null}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link href={taxonomy.questionsPath} prefetch={false} className="inline-flex h-10 items-center gap-2 rounded-md bg-[#615fff] px-4 text-xs font-black text-white hover:bg-[#514dff]"><ListChecks size={15} /> Resolver questões</Link>
          <span className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-xs font-black text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"><FileQuestion size={15} className="text-[#615fff]" /> {taxonomy.questionCount.toLocaleString('pt-BR')} questões públicas</span>
        </div>
      </header>

      {taxonomy.topics.length ? <section className={`${PLATFORM_SURFACE_CARD_CLASS} p-5 sm:p-6`} aria-labelledby="knowledge-topics"><h2 id="knowledge-topics" className="text-base font-black">Tópicos</h2><div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{taxonomy.topics.map((item) => <div key={item.id} className="rounded-md border border-slate-200 p-3 dark:border-slate-800"><Link href={item.path!} prefetch={false} className="flex items-center gap-2 text-sm font-black hover:text-[#615fff]"><BookOpen size={15} /> <span className="min-w-0 flex-1">{item.name}</span><ChevronRight size={14} /></Link>{item.questionsPath ? <Link href={item.questionsPath} prefetch={false} className="mt-2 inline-block text-xs text-slate-500 hover:text-[#615fff]">{item.questionCount.toLocaleString('pt-BR')} questões</Link> : null}</div>)}</div></section> : null}

      {taxonomy.subjects.length ? <section className={`${PLATFORM_SURFACE_CARD_CLASS} p-5 sm:p-6`} aria-labelledby="knowledge-subjects"><h2 id="knowledge-subjects" className="text-base font-black">Assuntos</h2>{directSubjects.length ? <div className="mt-4 grid gap-2 sm:grid-cols-2">{directSubjects.map((item) => <Link key={item.id} href={item.path!} prefetch={false} className="rounded-md border border-slate-200 px-4 py-3 text-sm font-bold hover:border-[#615fff]/40 hover:text-[#615fff] dark:border-slate-800">{item.name}</Link>)}</div> : null}{taxonomy.subtopics.map((subtopic) => { const items = taxonomy.subjects.filter((item) => item.subtopicId === subtopic.id); return items.length ? <div key={subtopic.id} className="mt-5"><h3 className="text-sm font-black text-slate-700 dark:text-slate-200">{subtopic.name}</h3><div className="mt-2 grid gap-2 sm:grid-cols-2">{items.map((item) => <Link key={item.id} href={item.path!} prefetch={false} className="rounded-md border border-slate-200 px-4 py-3 text-sm font-bold hover:border-[#615fff]/40 hover:text-[#615fff] dark:border-slate-800">{item.name}</Link>)}</div></div> : null; })}</section> : null}

      <section className={`${PLATFORM_SURFACE_CARD_CLASS} p-5 sm:p-6`} aria-labelledby="knowledge-questions"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 id="knowledge-questions" className="text-base font-black">Questões recentes</h2><p className="mt-1 text-xs text-slate-500">Coleção pública vinculada a esta taxonomia.</p></div><Link href={taxonomy.questionsPath} prefetch={false} className="inline-flex items-center gap-1 text-xs font-black text-[#615fff] hover:underline">Abrir ferramenta <ArrowRight size={13} /></Link></div>{taxonomy.questions.length ? <ol className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">{taxonomy.questions.map((question) => <li key={question.id} className="py-3 first:pt-0 last:pb-0"><Link href={question.path} prefetch={false} className="flex items-start gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-indigo-50 text-xs font-black text-[#615fff] dark:bg-indigo-500/10">{question.id}</span><span className="line-clamp-3 text-sm font-semibold leading-6">{question.excerpt || `Questão ${question.id}`}</span></Link></li>)}</ol> : <p className="mt-4 text-sm text-slate-500">Nenhuma questão pública disponível nesta coleção.</p>}</section>

      {(taxonomy.boards.length || taxonomy.organizations.length || taxonomy.exams.length) ? <section className="grid gap-5 xl:grid-cols-3" aria-label="Relações públicas">
        {taxonomy.boards.length ? <div className={`${PLATFORM_SURFACE_CARD_CLASS} p-5`}><h2 className="flex items-center gap-2 text-base font-black"><Landmark size={17} /> Bancas</h2><div className="mt-3 flex flex-wrap gap-2">{taxonomy.boards.map((item) => <Link key={item.id} href={item.path} prefetch={false} className="rounded-md border px-3 py-2 text-xs font-bold hover:text-[#615fff] dark:border-slate-700">{item.acronym || item.name}</Link>)}</div></div> : null}
        {taxonomy.organizations.length ? <div className={`${PLATFORM_SURFACE_CARD_CLASS} p-5`}><h2 className="flex items-center gap-2 text-base font-black"><Landmark size={17} /> Órgãos</h2><div className="mt-3 flex flex-wrap gap-2">{taxonomy.organizations.map((item) => <Link key={item.id} href={item.path} prefetch={false} className="rounded-md border px-3 py-2 text-xs font-bold hover:text-[#615fff] dark:border-slate-700">{item.acronym || item.name}</Link>)}</div></div> : null}
        {taxonomy.exams.length ? <div className={`${PLATFORM_SURFACE_CARD_CLASS} p-5`}><h2 className="flex items-center gap-2 text-base font-black"><FileText size={17} /> Provas</h2><div className="mt-3 space-y-2">{taxonomy.exams.map((item) => <Link key={item.id} href={item.path} prefetch={false} className="block rounded-md border px-3 py-2 text-xs font-bold hover:text-[#615fff] dark:border-slate-700">{item.name}</Link>)}</div></div> : null}
      </section> : null}
    </article>
  );
}
