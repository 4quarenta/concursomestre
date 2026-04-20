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
import { Shield } from 'lucide-react';
import { PLATFORM_PAGE_DESCRIPTION_CLASS, PLATFORM_PAGE_TITLE_CLASS } from '@constants/layout';

interface AdminPageHeaderProps {
  title: string;
  description?: string;
  activeSectionLabel?: string;
}

const AdminPageHeader = ({ title, description = 'Gestao completa da plataforma.', activeSectionLabel }: AdminPageHeaderProps) => (
  <header className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
    <div className="min-w-0">
      <div className="mb-1 flex items-center gap-2">
        <h1 className={`flex items-center gap-2 ${PLATFORM_PAGE_TITLE_CLASS}`}>
          <Shield className="text-rose-600" />
          {title}
        </h1>
        <span className="rounded-md border border-rose-200 bg-rose-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-rose-700 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-400">
          Admin
        </span>
      </div>
      <p className={PLATFORM_PAGE_DESCRIPTION_CLASS}>{description}</p>
      {activeSectionLabel ? (
        <div className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          <span className="text-slate-400">Secao ativa</span>
          <span className="rounded-full bg-indigo-50 px-2 py-1 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-300">
            {activeSectionLabel}
          </span>
        </div>
      ) : null}
    </div>
  </header>
);

export default AdminPageHeader;
