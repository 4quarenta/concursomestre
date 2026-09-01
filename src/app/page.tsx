import LandingPage from './landing/LandingPage';
import { buildSiteUrl } from '@/config/siteUrl';
import StructuredData from '@/components/seo/StructuredData';
import { fetchPublicMarketingSettings } from './publicMarketingSettings';
import { fetchHomeSeoDataForServer } from './landing/homeSeoServerData';
import { buildItemList } from '@services/seo/structuredData';
import { publicRoutes } from '@services/routes/publicRoutes';

/**
 * Rota raiz da plataforma.
 * A landing publica deve ser materializada no servidor para preservar SEO,
 * performance inicial e hidratacao igual ao restante das paginas publicas.
 *
 * @since 1.0.0
 */
export default async function HomePage() {
  const publicMarketingSettings = await fetchPublicMarketingSettings();
  const homeSeo = await fetchHomeSeoDataForServer(publicMarketingSettings.settings?.landingPageContent?.featuredOrganizations || []);
  const structuredLists = [
    ...(homeSeo.latestArticles.length > 0
      ? [buildItemList(homeSeo.latestArticles.map((article) => ({ name: article.title, path: `/blog/${article.slug}` })))]
      : []),
    ...(homeSeo.featuredOrganizations.length > 0
      ? [buildItemList(homeSeo.featuredOrganizations.map((organization) => ({ name: organization.name, path: publicRoutes.organizations.detail(organization.slug) })))]
      : []),
  ];
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${buildSiteUrl('/')}#organization`,
        name: 'ConcursoMestre',
        url: buildSiteUrl('/'),
        logo: buildSiteUrl('/branding/logo-light.png'),
      },
      {
        '@type': 'WebSite',
        '@id': `${buildSiteUrl('/')}#website`,
        name: 'ConcursoMestre',
        url: buildSiteUrl('/'),
        publisher: { '@id': `${buildSiteUrl('/')}#organization` },
        inLanguage: 'pt-BR',
      },
      ...structuredLists,
    ],
  };

  return (
    <>
      <StructuredData value={structuredData} />
      <LandingPage
        initialSystemSettings={publicMarketingSettings.settings}
        latestArticles={homeSeo.latestArticles}
        featuredOrganizations={homeSeo.featuredOrganizations}
      />
    </>
  );
}
