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
import { PLATFORM_PAGE_DESCRIPTION_CLASS, PLATFORM_PAGE_TITLE_CLASS } from '@constants/layout';

interface AdminPageHeaderProps {
  title: string;
  description?: string;
  activeSectionLabel?: string;
}

const AdminPageHeader = ({
  title,
  description = 'Gestao completa da plataforma.',
  activeSectionLabel,
}: AdminPageHeaderProps) => (
  <header className="mb-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className={PLATFORM_PAGE_TITLE_CLASS}>{title}</h1>
        <p className={`mt-1 ${PLATFORM_PAGE_DESCRIPTION_CLASS}`}>{description}</p>
      </div>

      {activeSectionLabel ? (
        <div className="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          {activeSectionLabel}
        </div>
      ) : null}
    </div>
  </header>
);

export default AdminPageHeader;
