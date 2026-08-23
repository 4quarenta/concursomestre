import type { Metadata } from 'next';
import { buildNoIndexMetadata, buildPublicPageMetadata } from '../seoMetadata';
import {
  evaluateSeoLaunchControl,
  getSeoLaunchMode,
  launchModeRobots,
  resolveSeoProductionFamily,
} from '@services/seo/launchControl';
import type { PublicBlogTaxonomy } from '@services/blog';
import { isSeoRuntimeIndexingAllowed } from '@services/seo/runtimeEnvironment';

export const buildUnpromotedBlogTaxonomyMetadata = ({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}): Metadata => ({
  ...buildPublicPageMetadata({ title, description, path }),
  robots: launchModeRobots(true),
});

export const blogTaxonomyTitle = (taxonomy: PublicBlogTaxonomy): string => (
  taxonomy.type === 'category'
    ? `${taxonomy.label}: notícias e editais`
    : `${taxonomy.label}: notícias de concursos`
);

export const blogTaxonomyDescription = (taxonomy: PublicBlogTaxonomy): string => (
  taxonomy.description
  || (taxonomy.type === 'category'
    ? `Acompanhe notícias e atualizações editoriais da categoria ${taxonomy.label} no ConcursoMestre.`
    : `Consulte publicações do blog relacionadas à tag ${taxonomy.label}.`)
);

export const buildBlogTaxonomyMetadata = (
  taxonomy: PublicBlogTaxonomy | null,
  hasFunctionalQuery = false,
): Metadata => {
  if (!taxonomy) return buildNoIndexMetadata({ title: 'Taxonomia do blog não encontrada' });
  const metadata = buildPublicPageMetadata({
    title: blogTaxonomyTitle(taxonomy),
    description: blogTaxonomyDescription(taxonomy),
    path: taxonomy.canonicalPath,
  });
  const launchMode = getSeoLaunchMode();
  const environmentAllowed = isSeoRuntimeIndexingAllowed(launchMode);
  const decision = evaluateSeoLaunchControl({
    launchMode,
    family: resolveSeoProductionFamily(taxonomy.canonicalPath),
    instanceReadiness: taxonomy.readiness,
    publicationAllowed: taxonomy.articleCount > 0,
    resolutionAction: 'render',
    httpStatus: 200,
    canonicalValid: true,
    qualityStatus: 'NOT_EVALUATED',
    canonicalEnvironment: environmentAllowed,
    productionActivationAllowed: environmentAllowed,
  });
  return decision.indexability === 'INDEX' && !hasFunctionalQuery
    ? metadata
    : { ...metadata, robots: launchModeRobots(true) };
};
