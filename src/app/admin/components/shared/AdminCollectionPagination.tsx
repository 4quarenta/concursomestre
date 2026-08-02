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

interface AdminCollectionPaginationProps {
  visibleCount: number;
  totalCount: number;
  itemLabel: string;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const AdminCollectionPagination = ({
  visibleCount,
  totalCount,
  itemLabel,
  page,
  totalPages,
  onPageChange,
}: AdminCollectionPaginationProps) => (
  <div className={`${ADMIN_PAGE_PANEL_CLASS} flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`}>
    <span className="text-sm text-slate-500 dark:text-slate-400">
      Mostrando {visibleCount} de {totalCount} {itemLabel}
    </span>
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-30 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        Anterior
      </button>
      <span className="flex items-center px-4 text-sm font-semibold text-blue-600 dark:text-blue-300">
        Pagina {page} de {totalPages}
      </span>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-30 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        Proxima
      </button>
    </div>
  </div>
);

export default AdminCollectionPagination;
