'use client';

import Link from 'next/link';
import { ArrowRight, Building2, Landmark, Scale, Shield } from 'lucide-react';
import type { HomeFeaturedOrganization, HomeLatestArticle } from '../homeSeoServerData';
import { publicRoutes } from '@services/routes/publicRoutes';

const ICONS = { building: Building2, landmark: Landmark, shield: Shield, scale: Scale } as const;

const formatDate = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeZone: 'UTC' }).format(date);
};

export default function HomeSeoSections({
  latestArticles,
  featuredOrganizations,
}: {
  latestArticles: HomeLatestArticle[];
  featuredOrganizations: HomeFeaturedOrganization[];
}) {
  return (
    <>
      {latestArticles.length > 0 ? (
        <section className="mx-auto w-full max-w-7xl px-5 py-16 sm:px-8" aria-labelledby="home-noticias-title">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#684cff]">Conteúdo recente</p>
              <h2 id="home-noticias-title" className="mt-2 text-2xl font-black tracking-tight text-[#07103a] md:text-3xl">Últimas notícias</h2>
              <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-slate-600">Acompanhe publicações recentes sobre concursos, editais e preparação.</p>
            </div>
            <Link href="/blog" prefetch={false} className="inline-flex items-center gap-2 text-sm font-black text-[#684cff] hover:text-[#4f39d4]">
              Ver todas as notícias <ArrowRight size={16} />
            </Link>
          </div>
          <div className="mt-9 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {latestArticles.map((article) => (
              <article key={article.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                {article.coverImageUrl ? (
                  <Link href={`/blog/${article.slug}`} prefetch={false} className="block overflow-hidden bg-slate-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={article.coverImageUrl} alt={article.coverImageAlt} width={960} height={540} loading="lazy" decoding="async" className="aspect-[16/9] w-full object-cover" />
                  </Link>
                ) : null}
                <div className="p-5">
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-indigo-600">{article.taxonomy.category.label}</p>
                  <h3 className="mt-3 text-lg font-black leading-6 text-[#07103a]"><Link href={`/blog/${article.slug}`} prefetch={false} className="hover:text-[#684cff]">{article.title}</Link></h3>
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{article.excerpt}</p>
                  <time dateTime={article.publishedAt || article.updatedAt} className="mt-4 block text-xs font-semibold text-slate-500">{formatDate(article.publishedAt || article.updatedAt)}</time>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {featuredOrganizations.length > 0 ? (
        <section className="mx-auto w-full max-w-7xl px-5 py-16 sm:px-8" aria-labelledby="home-orgaos-title">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#684cff]">Diretório público</p>
              <h2 id="home-orgaos-title" className="mt-2 text-2xl font-black tracking-tight text-[#07103a] md:text-3xl">Órgãos em destaque</h2>
              <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-slate-600">Explore páginas públicas de órgãos selecionados pela equipe editorial.</p>
            </div>
            <Link href="/orgaos" prefetch={false} className="inline-flex items-center gap-2 text-sm font-black text-[#684cff] hover:text-[#4f39d4]">Ver todos os órgãos <ArrowRight size={16} /></Link>
          </div>
          <div className="mt-9 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featuredOrganizations.map((organization) => {
              const Icon = ICONS[organization.iconKey] || Building2;
              return (
                <article key={organization.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-indigo-50 text-[#684cff]">
                      {organization.imageUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={organization.imageUrl} alt={organization.name} width={44} height={44} loading="lazy" decoding="async" className="h-11 w-11 rounded-lg object-contain p-1" />
                      ) : <Icon size={21} aria-hidden="true" />}
                    </span>
                    <span className="rounded-md bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-slate-600">{organization.statusLabel}</span>
                  </div>
                  <h3 className="mt-5 text-lg font-black text-[#07103a]">{organization.acronym && organization.acronym !== organization.name ? `${organization.acronym} - ${organization.name}` : organization.name}</h3>
                  {organization.description ? <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{organization.description}</p> : null}
                  <Link href={publicRoutes.organizations.detail(organization.slug)} prefetch={false} className="mt-5 inline-flex items-center gap-2 text-sm font-black text-[#684cff] hover:text-[#4f39d4]">Conhecer órgão <ArrowRight size={16} /></Link>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}
    </>
  );
}
