import type { ReactNode } from 'react';
import Link from 'next/link';
import { MessageSquare } from 'lucide-react';
import PlatformPageHeader from '@/components/shared/layout/PlatformPageHeader';
import StructuredData from '@/components/seo/StructuredData';
import { PLATFORM_MAIN_CONTENT_WIDTH_CLASS } from '@constants/layout';
import { buildPublicPageMetadata } from '../seoMetadata';
import { buildBreadcrumbList, buildStructuredDataGraph, buildWebPage } from '@services/seo/structuredData';

export const metadata = buildPublicPageMetadata({
  title: 'Suporte',
  description: 'Abra uma solicitação, relate problemas, envie sugestões e acompanhe o atendimento do ConcursoMestre.',
  path: '/support',
});

export default function SupportLayout({ children }: Readonly<{ children: ReactNode }>) {
  const breadcrumbs = [{ label: 'Início', path: '/' }, { label: 'Suporte', path: '/support' }];
  const structuredData = buildStructuredDataGraph([
    buildWebPage({ path: '/support', name: 'Suporte ConcursoMestre', description: 'Canais oficiais de ajuda e atendimento do ConcursoMestre.' }),
    buildBreadcrumbList(breadcrumbs),
  ]);
  return (
    <>
      <StructuredData value={structuredData} />
      <div className={`mx-auto w-full ${PLATFORM_MAIN_CONTENT_WIDTH_CLASS}`} data-semantic-content>
        <PlatformPageHeader
          breadcrumbs={breadcrumbs}
          title="Como podemos ajudar?"
          description="Envie uma dúvida, relate um problema ou compartilhe uma sugestão."
          action={<Link
            href="/profile/support-history"
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-indigo-200 px-4 text-sm font-semibold text-indigo-700 transition-colors hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-950/40"
          >
            <MessageSquare size={16} aria-hidden="true" />
            Meus atendimentos
          </Link>}
        />
      </div>
      {children}
    </>
  );
}
