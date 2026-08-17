import LandingPage from './landing/LandingPage';
import { buildSiteUrl } from '@/config/siteUrl';
import { serializeStructuredData } from '@services/seo/structuredData';
import { fetchPublicMarketingSettings } from './publicMarketingSettings';

/**
 * Rota raiz da plataforma.
 * A landing publica deve ser materializada no servidor para preservar SEO,
 * performance inicial e hidratacao igual ao restante das paginas publicas.
 *
 * @since 1.0.0
 */
export default async function HomePage() {
  const publicMarketingSettings = await fetchPublicMarketingSettings();
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
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeStructuredData(structuredData) }} />
      <LandingPage initialSystemSettings={publicMarketingSettings.settings} />
    </>
  );
}
