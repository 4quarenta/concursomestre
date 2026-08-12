import type { ReactNode } from 'react';
import LandingCommercialFooter from '../landing/components/LandingCommercialFooter';
import { buildPublicPageMetadata } from '../seoMetadata';

export const metadata = buildPublicPageMetadata({
  title: 'Novidades',
  description: 'Acompanhe novos recursos, melhorias e correções do ConcursoMestre em linguagem simples.',
  path: '/novidades',
});

export default function NovidadesLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <>
      {children}
      <div className="bg-white text-[#07103a] dark:bg-white">
        <LandingCommercialFooter />
      </div>
    </>
  );
}
