import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import CanonicalBreadcrumbs from '@/components/seo/CanonicalBreadcrumbs';
import StructuredData from '@/components/seo/StructuredData';
import ModuleAccessFallback from '@/components/shared/feedback/ModuleAccessFallback';
import { buildNoIndexMetadata } from '../seoMetadata';
import LegalCommentaryClient from './LegalCommentaryClient';
import { publicRoutes } from '@services/routes/publicRoutes';
import { buildBreadcrumbList, buildCollectionPage, buildItemList, buildStructuredDataGraph } from '@services/seo/structuredData';
import {
  fetchLegalCommentaryModuleAvailability,
  fetchLegalHomeSnapshot,
} from './legalCommentaryServerData';

export const revalidate = 300;

const LegalCatalogFallback = ({
  snapshot,
}: {
  snapshot: Awaited<ReturnType<typeof fetchLegalHomeSnapshot>>;
}) => {
  const laws = snapshot.lawsByArea.flatMap(({ laws: areaLaws }) => areaLaws);
  const uniqueLaws = Array.from(new Map(laws.map((law) => [String(law.id), law])).values());

  return (
    <section aria-labelledby="legal-public-catalog-title" className="space-y-4" data-hydration-interaction>
      <h2 id="legal-public-catalog-title" className="text-xl font-black text-slate-900 dark:text-slate-100">
        Normas disponíveis
      </h2>
      <ul className="grid gap-3 md:grid-cols-2">
        {uniqueLaws.map((law) => (
          <li key={String(law.id)}>
            <Link
              href={publicRoutes.laws.detail(law.slug)}
              className="block rounded-md border border-slate-200 bg-white p-4 font-bold text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
            >
              {law.title}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
};

export async function generateMetadata(): Promise<Metadata> {
  const isModuleAvailable = await fetchLegalCommentaryModuleAvailability();
  return isModuleAvailable
    ? {}
    : buildNoIndexMetadata({
      title: 'Lei Comentada indisponível',
      description: 'O módulo de Lei Comentada não está disponível no momento.',
    });
}

export default async function LegalCommentaryPage() {
  const isModuleAvailable = await fetchLegalCommentaryModuleAvailability();
  if (!isModuleAvailable) {
    return (
      <div data-semantic-content>
        <ModuleAccessFallback
          tone="disabled"
          eyebrow="Módulo indisponível"
          title="Lei comentada indisponível"
          description="O módulo Lei comentada não está disponível no momento."
          ctaTo="/"
          ctaLabel="Voltar ao início"
        />
      </div>
    );
  }

  const snapshot = await fetchLegalHomeSnapshot();
  const laws = snapshot.lawsByArea.flatMap(({ laws: areaLaws }) => areaLaws);
  const uniqueLaws = Array.from(new Map(laws.map((law) => [String(law.id), law])).values());
  const path = publicRoutes.laws.index();
  const breadcrumbs = [{ label: 'Início', path: '/' }, { label: 'Lei Comentada', path }];
  const itemList = buildItemList(uniqueLaws.map((law) => ({ name: law.title, path: publicRoutes.laws.detail(law.slug) })));
  const jsonLd = buildStructuredDataGraph([
    { ...buildCollectionPage({ path, name: 'Lei Comentada', description: 'Legislação comentada para concursos públicos, com texto oficial e conteúdo editorial de estudo.' }), mainEntity: itemList },
    buildBreadcrumbList(breadcrumbs),
  ]);

  return (
    <>
      <StructuredData value={jsonLd} />
      <header className="space-y-4 pb-6" data-semantic-content>
        <CanonicalBreadcrumbs items={breadcrumbs} />
        <div>
          <p className="text-xs font-black uppercase text-indigo-600 dark:text-indigo-300">Biblioteca legislativa</p>
          <h1 className="mt-2 text-3xl font-black text-slate-900 dark:text-slate-100">Lei comentada</h1>
          <p className="mt-3 max-w-3xl text-sm font-medium leading-6 text-slate-600 dark:text-slate-300">
            Consulte normas públicas, navegue pelos artigos e identifique os recursos de estudo disponíveis em cada seção.
          </p>
        </div>
      </header>
      <Suspense fallback={<LegalCatalogFallback snapshot={snapshot} />}>
        <LegalCommentaryClient initialSnapshot={snapshot} semanticHeaderRendered />
      </Suspense>
    </>
  );
}
