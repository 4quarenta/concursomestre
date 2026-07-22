import { buildSiteUrl } from '@/config/siteUrl';
import LegalCommentaryClient from './LegalCommentaryClient';
import { fetchLegalHomeSnapshot } from './legalCommentaryServerData';

export const revalidate = 300;

const absoluteUrl = (path: string): string => buildSiteUrl(path);
const serializeJsonLd = (value: unknown): string => JSON.stringify(value).replace(/</g, '\\u003c');

export default async function LegalCommentaryPage() {
  const snapshot = await fetchLegalHomeSnapshot();
  const laws = snapshot.lawsByArea.flatMap(({ laws: areaLaws }) => areaLaws);
  const uniqueLaws = Array.from(new Map(laws.map((law) => [String(law.id), law])).values());
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: 'Lei Comentada',
        description: 'Legislação comentada para concursos públicos, com texto oficial e conteúdo editorial de estudo.',
        url: absoluteUrl('/lei-comentada'),
        inLanguage: 'pt-BR',
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: uniqueLaws.length,
          itemListElement: uniqueLaws.map((law, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: law.title,
            url: absoluteUrl(`/lei-comentada/${law.slug}`),
          })),
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Início', item: absoluteUrl('/') },
          { '@type': 'ListItem', position: 2, name: 'Lei Comentada', item: absoluteUrl('/lei-comentada') },
        ],
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      <LegalCommentaryClient initialSnapshot={snapshot} />
    </>
  );
}
