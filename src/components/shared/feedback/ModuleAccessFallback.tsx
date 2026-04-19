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

import React from 'react';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import {
  PLATFORM_MAIN_CONTENT_WIDTH_CLASS,
  PLATFORM_PAGE_DESCRIPTION_CLASS,
  PLATFORM_PAGE_TITLE_CLASS,
  PLATFORM_SURFACE_CARD_CLASS,
} from '@constants/layout';

interface ModuleAccessFallbackProps {
  description: string;
  ctaTo?: string;
  ctaLabel?: string;
}

const ModuleAccessFallback: React.FC<ModuleAccessFallbackProps> = ({
  description,
  ctaTo = '/',
  ctaLabel = 'Voltar ao inicio',
}) => (
  <section className={`mx-auto w-full ${PLATFORM_MAIN_CONTENT_WIDTH_CLASS} px-4 py-8 sm:px-6 lg:px-8`}>
    <div className={`${PLATFORM_SURFACE_CARD_CLASS} space-y-4 p-8`}>
      <p className="text-xs font-black uppercase tracking-[0.18em] text-rose-600">Erro 404</p>
      <h1 className={PLATFORM_PAGE_TITLE_CLASS}>Pagina nao encontrada</h1>
      <p className={PLATFORM_PAGE_DESCRIPTION_CLASS}>{description}</p>
      <Link
        href={ctaTo}
        className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-white transition-all hover:bg-indigo-700"
      >
        <ArrowLeft size={14} />
        {ctaLabel}
      </Link>
    </div>
  </section>
);

export default ModuleAccessFallback;
