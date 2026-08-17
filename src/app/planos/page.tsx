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

import { Suspense } from 'react';
import { buildSiteUrl } from '@/config/siteUrl';
import { serializeStructuredData } from '@services/seo/structuredData';
import MarketingPlansLandingPage from './components/MarketingPlansLandingPage';
import { fetchPublicPlanCatalogForServer } from './plansServerData';

const PlansCatalogFallback = ({ plans }: { plans: Awaited<ReturnType<typeof fetchPublicPlanCatalogForServer>> }) => (
  <section
    aria-labelledby="plans-public-catalog-title"
    className="mx-auto w-full max-w-7xl px-6 pb-20"
    data-hydration-interaction
  >
    <h2 id="plans-public-catalog-title" className="text-xl font-black text-slate-900 dark:text-slate-100">
      Planos disponíveis
    </h2>
    <p className="mt-2 text-sm font-medium text-slate-600 dark:text-slate-300">
      Compare os ciclos e recursos públicos do catálogo enquanto a área interativa é preparada.
    </p>
    {plans.length > 0 ? (
      <ul className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => (
          <li key={String(plan.id)} className="rounded-md border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <strong className="block text-base text-slate-900 dark:text-slate-100">{plan.name}</strong>
            {plan.description ? <span className="mt-2 block text-sm text-slate-600 dark:text-slate-300">{plan.description}</span> : null}
          </li>
        ))}
      </ul>
    ) : null}
  </section>
);

/**
 * Shell publico da landing oficial de planos.
 * Mantem a rota /planos enxuta e delega a composicao para componentes locais.
 *
 * @since v1.0.0
 */
export default async function PlanosPage() {
  const initialPlans = await fetchPublicPlanCatalogForServer();
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Planos do ConcursoMestre',
    description: 'Compare os planos e escolha os recursos adequados para sua rotina de estudos.',
    url: buildSiteUrl('/planos'),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeStructuredData(structuredData) }} />
      <main className="min-h-screen bg-white text-slate-950 dark:bg-slate-950 dark:text-white">
        <header className="mx-auto w-full max-w-7xl px-6 pb-10 pt-16" data-semantic-content>
          <p className="text-xs font-black uppercase text-indigo-600 dark:text-indigo-300">Planos ConcursoMestre</p>
          <h1 className="mt-3 max-w-4xl text-3xl font-black leading-tight sm:text-4xl">
            Estude com mais estratégia e escolha o plano adequado à sua rotina
          </h1>
          <p className="mt-4 max-w-3xl text-base font-medium leading-7 text-slate-600 dark:text-slate-300">
            Compare recursos, ciclos de cobrança e condições públicas antes de iniciar o checkout seguro.
          </p>
          <nav aria-label="Ações dos planos" className="mt-6 flex flex-wrap gap-3">
            <a href="#comparar-planos" className="rounded-md bg-indigo-600 px-5 py-3 text-sm font-black text-white">Comparar planos</a>
            <a href="/support" className="rounded-md border border-slate-300 px-5 py-3 text-sm font-black dark:border-slate-700">Tirar dúvidas</a>
          </nav>
        </header>
        <Suspense fallback={<PlansCatalogFallback plans={initialPlans} />}>
          <MarketingPlansLandingPage slug="planos" initialPlans={initialPlans} semanticHeadingRendered />
        </Suspense>
      </main>
    </>
  );
}
