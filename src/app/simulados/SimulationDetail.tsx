import Link from 'next/link';
import { BookOpen, BriefcaseBusiness, Building2, ChevronRight, Clock3, ClipboardList, FileQuestion, FileText, Landmark, PlayCircle, UsersRound } from 'lucide-react';
import { buildSiteUrl } from '@/config/siteUrl';
import { PLATFORM_PAGE_DESCRIPTION_CLASS, PLATFORM_PAGE_TITLE_CLASS, PLATFORM_SURFACE_CARD_CLASS } from '@constants/layout';
import { serializeStructuredData } from '@services/seo/structuredData';
import { simulationDescription } from './simulationMetadata';
import type { PublicSimulationDetail } from './simulationServerData';

const relationLabels: Record<string, string> = { discipline: 'Disciplinas', topic: 'Tópicos', subject: 'Assuntos', career: 'Carreiras', position: 'Cargos', board: 'Bancas', organization: 'Órgãos' };
const relationIcons: Record<string, typeof BookOpen> = { discipline: BookOpen, topic: BookOpen, subject: BookOpen, career: UsersRound, position: BriefcaseBusiness, board: Landmark, organization: Building2 };

export default function SimulationDetail({ item }: { item: PublicSimulationDetail }) {
  const description = simulationDescription(item); const canonical = buildSiteUrl(item.canonicalPath);
  const grouped = item.taxonomies.reduce<Record<string, typeof item.taxonomies>>((groups, taxonomy) => {
    (groups[taxonomy.relationType] ||= []).push(taxonomy);
    return groups;
  }, {});
  const structuredData = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'WebPage', '@id': `${canonical}#webpage`, url: canonical, name: item.title, description },
    { '@type': 'BreadcrumbList', itemListElement: item.breadcrumbs.map((crumb,index)=>({ '@type':'ListItem', position:index+1, name:crumb.label, item:buildSiteUrl(crumb.canonicalPath) })) },
    ...(item.questions.length ? [{ '@type':'ItemList', name:'Questões apresentadas nesta página', numberOfItems:item.questions.length, itemListElement:item.questions.map((question,index)=>({ '@type':'ListItem', position:index+1, name:question.excerpt||`Questão ${question.id}`, url:buildSiteUrl(question.path) })) }] : []),
  ] };
  return <article data-semantic-content className="w-full space-y-5 animate-fade-in">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeStructuredData(structuredData) }} />
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-slate-500">{item.breadcrumbs.map((crumb,index)=><span key={crumb.canonicalPath} className="inline-flex items-center gap-1.5">{index?<ChevronRight size={12}/>:null}{index===item.breadcrumbs.length-1?<span aria-current="page">{crumb.label}</span>:<Link href={crumb.canonicalPath}>{crumb.label}</Link>}</span>)}</nav>
    <header className={`${PLATFORM_SURFACE_CARD_CLASS} p-5 sm:p-6`}><p className="text-[10px] font-black uppercase text-indigo-700">Simulado editorial</p><h1 className={`mt-2 ${PLATFORM_PAGE_TITLE_CLASS}`}>{item.title}</h1><p className={`mt-3 max-w-4xl ${PLATFORM_PAGE_DESCRIPTION_CLASS}`}>{description}</p><div className="mt-4 flex flex-wrap gap-3 text-sm font-bold text-slate-600 dark:text-slate-300"><span className="inline-flex items-center gap-1.5"><FileQuestion size={16}/>{item.questionCount} questões</span>{item.durationMinutes?<span className="inline-flex items-center gap-1.5"><Clock3 size={16}/>{item.durationMinutes} minutos</span>:null}</div>{item.isAttemptAvailable&&item.readiness.status==='READY'?<Link href={item.practicePath} className="mt-5 inline-flex h-10 items-center gap-2 rounded-md bg-[#615fff] px-4 text-xs font-black text-white"><PlayCircle size={16}/> Abrir área de simulados</Link>:<p className="mt-5 text-sm font-semibold text-slate-500">Este simulado ainda não está disponível para iniciar.</p>}</header>
    {item.instructions?<section className={`${PLATFORM_SURFACE_CARD_CLASS} p-5`} aria-labelledby="instructions"><h2 id="instructions" className="font-black">Orientações</h2><p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-600 dark:text-slate-300">{item.instructions}</p></section>:null}
    {Object.entries(grouped).map(([relationType,values])=>{if(!values?.length)return null;const Icon=relationIcons[relationType]||BookOpen;return <section key={relationType} className={`${PLATFORM_SURFACE_CARD_CLASS} p-5`}><h2 className="flex items-center gap-2 font-black"><Icon size={17} className="text-[#615fff]"/>{relationLabels[relationType]||'Relações'}</h2><div className="mt-4 flex flex-wrap gap-2">{values.map((related)=><Link key={`${relationType}-${related.id}`} href={related.path} className="rounded-md border border-slate-200 px-3 py-2 text-sm font-bold hover:text-[#615fff] dark:border-slate-700">{related.name}</Link>)}</div></section>})}
    <section className="grid gap-5 xl:grid-cols-2">
      <div className={`${PLATFORM_SURFACE_CARD_CLASS} p-5`}><h2 className="flex items-center gap-2 font-black"><ClipboardList size={17} className="text-[#615fff]"/> Concursos relacionados</h2>{item.contests.length?<div className="mt-4 space-y-2">{item.contests.map((contest)=><Link key={contest.id} href={contest.path} className="block rounded-md border border-slate-200 p-3 text-sm font-bold hover:text-[#615fff] dark:border-slate-700">{contest.title}</Link>)}</div>:<p className="mt-3 text-sm text-slate-500">Nenhum concurso foi editorialmente relacionado.</p>}</div>
      <div className={`${PLATFORM_SURFACE_CARD_CLASS} p-5`}><h2 className="flex items-center gap-2 font-black"><FileText size={17} className="text-[#615fff]"/> Provas relacionadas</h2>{item.exams.length?<div className="mt-4 space-y-2">{item.exams.map((exam)=><Link key={exam.id} href={exam.path} className="flex justify-between rounded-md border border-slate-200 p-3 text-sm font-bold hover:text-[#615fff] dark:border-slate-700"><span>{exam.title}</span><span className="text-xs text-slate-500">{exam.year||''}</span></Link>)}</div>:<p className="mt-3 text-sm text-slate-500">Nenhuma prova foi editorialmente relacionada.</p>}</div>
    </section>
    <section className={`${PLATFORM_SURFACE_CARD_CLASS} p-5`} aria-labelledby="question-preview"><h2 id="question-preview" className="flex items-center gap-2 font-black"><FileQuestion size={17} className="text-[#615fff]"/> Questões apresentadas</h2>{item.questions.length?<ol className="mt-4 space-y-2">{item.questions.map((question)=><li key={question.id}><Link href={question.path} className="line-clamp-2 text-sm font-semibold hover:text-[#615fff]">{question.excerpt||`Questão ${question.id}`}</Link></li>)}</ol>:<p className="mt-3 text-sm text-slate-500">A composição pública ainda não está pronta.</p>}</section>
  </article>;
}
