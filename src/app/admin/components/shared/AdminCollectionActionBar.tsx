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
import { ADMIN_PAGE_PANEL_CLASS } from './adminPanelStyles';

interface AdminCollectionActionBarProps {
  children: React.ReactNode;
  summary: React.ReactNode;
}

const AdminCollectionActionBar = ({ children, summary }: AdminCollectionActionBarProps) => (
  <div className={`${ADMIN_PAGE_PANEL_CLASS} flex flex-col gap-3 transition-colors duration-300 lg:flex-row lg:items-center lg:justify-between`}>
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
        Ações em massa
      </span>
      {children}
    </div>
    <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
      {summary}
    </span>
  </div>
);

export default AdminCollectionActionBar;
