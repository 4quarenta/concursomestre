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
import { ChevronLeft, ChevronRight } from 'lucide-react';
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
    <nav className="flex flex-wrap items-center gap-2" aria-label={`Paginacao de ${itemLabel}`}>
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className="inline-flex h-9 items-center gap-1 rounded-sm border border-slate-300 bg-white px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <ChevronLeft size={14} />
        Anterior
      </button>
      <span className="flex min-h-9 items-center px-3 text-sm font-semibold text-sky-700 dark:text-sky-300" aria-current="page">
        Pagina {page} de {Math.max(1, totalPages)}
      </span>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className="inline-flex h-9 items-center gap-1 rounded-sm border border-slate-300 bg-white px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        Proxima
        <ChevronRight size={14} />
      </button>
    </nav>
  </div>
);

export default AdminCollectionPagination;
