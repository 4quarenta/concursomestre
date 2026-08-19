import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowRight,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  ChevronRight,
  ExternalLink,
  FileQuestion,
  FileText,
  Landmark,
  ListChecks,
  MapPin,
} from 'lucide-react';
import { buildSiteUrl } from '@/config/siteUrl';
import {
  PLATFORM_PAGE_DESCRIPTION_CLASS,
  PLATFORM_PAGE_TITLE_CLASS,
  PLATFORM_SURFACE_CARD_CLASS,
} from '@constants/layout';
import { serializeStructuredData } from '@services/seo/structuredData';
import {
  buildOrganizationMetadata,
  organizationDescription,
  organizationDisplayName,
} from '../organizationMetadata';
import { fetchPublicOrganizationForServer } from '../organizationServerData';

export const revalidate = 300;

type OrganizationPageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: OrganizationPageProps): Promise<Metadata> {
  const { slug } = await params;
  return buildOrganizationMetadata(await fetchPublicOrganizationForServer(slug));
}

export default async function OrganizationPage({ params }: OrganizationPageProps) {
  const { slug } = await params;
  const organization = await fetchPublicOrganizationForServer(slug);
  if (!organization) notFound();

  const canonicalUrl = buildSiteUrl(organization.canonicalPath);
  const displayName = organizationDisplayName(organization);
  const description = organizationDescription(organization);
  const breadcrumbItems = organization.breadcrumbs.map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: item.label,
    item: buildSiteUrl(item.canonicalPath),
  }));
  const questionItems = organization.questions.map((question, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: question.excerpt || `Questão ${question.id}`,
    url: buildSiteUrl(question.path),
  }));
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${canonicalUrl}#webpage`,
        url: canonicalUrl,
        name: displayName,
        description,
        mainEntity: { '@id': `${canonicalUrl}#organization` },
      },
      {
        '@type': 'Organization',
        '@id': `${canonicalUrl}#organization`,
        name: organization.name,
        alternateName: organization.acronym || undefined,
        description: organization.description || undefined,
        url: canonicalUrl,
        sameAs: organization.website ? [organization.website] : undefined,
        logo: organization.imageUrl || undefined,
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${canonicalUrl}#breadcrumb`,
        itemListElement: breadcrumbItems,
      },
      ...(questionItems.length > 0 ? [{
        '@type': 'ItemList',
        '@id': `${canonicalUrl}#questions`,
        numberOfItems: questionItems.length,
        itemListElement: questionItems,
      }] : []),
    ],
  };

  return (
    <article data-semantic-content className="w-full animate-fade-in space-y-5">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeStructuredData(structuredData) }} />

      <nav data-breadcrumbs aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-slate-500">
        {organization.breadcrumbs.map((item, index) => (
          <span key={`${item.canonicalPath}-${item.label}`} className="inline-flex items-center gap-1.5">
            {index > 0 ? <ChevronRight size={12} aria-hidden="true" /> : null}
            {index === organization.breadcrumbs.length - 1
              ? <span aria-current="page" className="text-slate-700 dark:text-slate-200">{item.label}</span>
              : <Link href={item.canonicalPath} prefetch={false} className="hover:text-[#615fff] hover:underline">{item.label}</Link>}
          </span>
        ))}
      </nav>

      <header className={`${PLATFORM_SURFACE_CARD_CLASS} p-5 sm:p-6`}>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          {organization.imageUrl ? (
            <Image
              src={organization.imageUrl}
              alt={`Logo de ${organization.name}`}
              width={72}
              height={72}
              unoptimized
              className="h-[72px] w-[72px] shrink-0 rounded-md border border-slate-200 bg-white object-contain p-2 dark:border-slate-700"
            />
          ) : (
            <span className="grid h-[72px] w-[72px] shrink-0 place-items-center rounded-md bg-indigo-50 text-[#615fff] dark:bg-indigo-500/10 dark:text-indigo-300">
              <Building2 size={30} aria-hidden="true" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-700 dark:text-indigo-300">Órgão público</p>
            <h1 className={`mt-2 ${PLATFORM_PAGE_TITLE_CLASS}`}>{displayName}</h1>
            <p className={`mt-3 max-w-4xl ${PLATFORM_PAGE_DESCRIPTION_CLASS}`}>{description}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
              {organization.sphere ? <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-2 dark:border-slate-700"><Landmark size={14} /> {organization.sphere}</span> : null}
              {organization.stateCode ? <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-2 dark:border-slate-700"><MapPin size={14} /> {organization.stateCode}</span> : null}
              {organization.website ? <a href={organization.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-2 hover:border-[#615fff]/40 hover:text-[#615fff] dark:border-slate-700">Site oficial <ExternalLink size={13} /></a> : null}
            </div>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link href={organization.questionsPath} prefetch={false} className="inline-flex h-10 items-center gap-2 rounded-md bg-[#615fff] px-4 text-xs font-black text-white hover:bg-[#514dff]">
            <ListChecks size={15} /> Resolver questões deste órgão
          </Link>
          <span className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-xs font-black text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"><FileQuestion size={15} className="text-[#615fff]" /> {organization.questionCount.toLocaleString('pt-BR')} questões</span>
          <span className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-xs font-black text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"><FileText size={15} className="text-[#615fff]" /> {organization.examCount.toLocaleString('pt-BR')} provas</span>
        </div>
      </header>

      <section className={`${PLATFORM_SURFACE_CARD_CLASS} p-5 sm:p-6`} aria-labelledby="organization-questions-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><h2 id="organization-questions-title" className="text-base font-black text-slate-950 dark:text-white">Questões relacionadas</h2><p className="mt-1 text-xs leading-5 text-slate-500">Primeira coleção pública vinculada ao órgão.</p></div>
          <Link href={organization.questionsPath} prefetch={false} className="inline-flex items-center gap-1 text-xs font-black text-[#615fff] hover:underline">Abrir prática <ArrowRight size={13} /></Link>
        </div>
        {organization.questions.length > 0 ? (
          <ol className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
            {organization.questions.map((question) => (
              <li key={question.id} className="py-3 first:pt-0 last:pb-0">
                <Link href={question.path} prefetch={false} className="group flex items-start gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-indigo-50 text-xs font-black text-[#615fff] dark:bg-indigo-500/10">{question.id}</span>
                  <span className="line-clamp-3 text-sm font-semibold leading-6 text-slate-700 group-hover:text-[#615fff] dark:text-slate-200">{question.excerpt || `Questão ${question.id}`}</span>
                </Link>
              </li>
            ))}
          </ol>
        ) : <p className="mt-4 text-sm text-slate-500">Ainda não há questões públicas vinculadas a este órgão.</p>}
      </section>

      {(organization.exams.length > 0 || organization.disciplines.length > 0) ? (
        <section className="grid gap-5 xl:grid-cols-2" aria-label="Conteúdo relacionado ao órgão">
          {organization.exams.length > 0 ? (
            <div className={`${PLATFORM_SURFACE_CARD_CLASS} p-5 sm:p-6`}><h2 className="flex items-center gap-2 text-base font-black text-slate-950 dark:text-white"><FileText size={17} className="text-[#615fff]" /> Provas relacionadas</h2><div className="mt-4 space-y-2">{organization.exams.map((exam) => <Link key={exam.id} href={exam.path} prefetch={false} className="flex items-center justify-between gap-3 rounded-md border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-700 hover:border-[#615fff]/40 hover:text-[#615fff] dark:border-slate-700 dark:text-slate-200"><span className="min-w-0 truncate">{exam.name}</span><span className="shrink-0 text-slate-500">{exam.year || 'Ano não informado'} · {exam.questionCount.toLocaleString('pt-BR')}</span></Link>)}</div></div>
          ) : null}
          {organization.disciplines.length > 0 ? (
            <div className={`${PLATFORM_SURFACE_CARD_CLASS} p-5 sm:p-6`}><h2 className="flex items-center gap-2 text-base font-black text-slate-950 dark:text-white"><BookOpen size={17} className="text-[#615fff]" /> Disciplinas recorrentes</h2><div className="mt-4 flex flex-wrap gap-2">{organization.disciplines.map((discipline) => <Link key={discipline.id} href={discipline.path} prefetch={false} className="rounded-md border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:border-[#615fff]/40 hover:text-[#615fff] dark:border-slate-700 dark:text-slate-200">{discipline.name} · {discipline.questionCount.toLocaleString('pt-BR')}</Link>)}</div></div>
          ) : null}
        </section>
      ) : null}

      {(organization.roles.length > 0 || organization.boards.length > 0) ? (
        <section className="grid gap-5 xl:grid-cols-2" aria-label="Taxonomias relacionadas ao órgão">
          {organization.roles.length > 0 ? (
            <div className={`${PLATFORM_SURFACE_CARD_CLASS} p-5 sm:p-6`}><h2 className="flex items-center gap-2 text-base font-black text-slate-950 dark:text-white"><BriefcaseBusiness size={17} className="text-[#615fff]" /> Cargos relacionados</h2><div className="mt-4 flex flex-wrap gap-2">{organization.roles.map((role) => <Link key={role.id} href={role.questionsPath} prefetch={false} className="rounded-md border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:border-[#615fff]/40 hover:text-[#615fff] dark:border-slate-700 dark:text-slate-200">{role.name}</Link>)}</div></div>
          ) : null}
          {organization.boards.length > 0 ? (
            <div className={`${PLATFORM_SURFACE_CARD_CLASS} p-5 sm:p-6`}><h2 className="flex items-center gap-2 text-base font-black text-slate-950 dark:text-white"><Landmark size={17} className="text-[#615fff]" /> Bancas relacionadas</h2><div className="mt-4 flex flex-wrap gap-2">{organization.boards.map((board) => <Link key={board.id} href={board.path} prefetch={false} className="rounded-md border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:border-[#615fff]/40 hover:text-[#615fff] dark:border-slate-700 dark:text-slate-200">{board.acronym || board.name} · {board.examCount.toLocaleString('pt-BR')} provas</Link>)}</div></div>
          ) : null}
        </section>
      ) : null}
    </article>
  );
}
