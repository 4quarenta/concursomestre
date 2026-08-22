import type { ReactNode } from 'react';
import CanonicalBreadcrumbs from '@/components/seo/CanonicalBreadcrumbs';
import StructuredData from '@/components/seo/StructuredData';
import { buildPublicPageMetadata } from '../seoMetadata';
import { buildBreadcrumbList, buildStructuredDataGraph } from '@services/seo/structuredData';
import { FAQ_DATA } from './faqContent';

export const metadata = buildPublicPageMetadata({
  title: 'Duvidas frequentes',
  description: 'Tire duvidas sobre planos, assinatura, reembolso, gamificacao, simulados, marketplace e suporte do ConcursoMestre.',
  path: '/faq',
});

export default function FaqLayout({ children }: Readonly<{ children: ReactNode }>) {
  const breadcrumbs = [{ label: 'Início', path: '/' }, { label: 'Dúvidas frequentes', path: '/faq' }];
  const faqPage = {
    '@type': 'FAQPage',
    '@id': 'https://concursomestre.com/faq#faq',
    url: 'https://concursomestre.com/faq',
    mainEntity: FAQ_DATA.flatMap((category) => category.questions).map((entry) => ({
      '@type': 'Question',
      name: entry.q,
      acceptedAnswer: { '@type': 'Answer', text: entry.a },
    })),
  };
  return (
    <>
      <StructuredData value={buildStructuredDataGraph([faqPage, buildBreadcrumbList(breadcrumbs)])} />
      <div className="mx-auto w-full max-w-4xl px-4 pt-6">
        <CanonicalBreadcrumbs items={breadcrumbs} />
      </div>
      {children}
    </>
  );
}
