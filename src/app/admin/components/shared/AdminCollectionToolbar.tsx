import React from 'react';
import { AdminFilters, AdminPrimaryAction, AdminSearch, AdminToolbar } from './AdminDesignSystem';
import {
  ADMIN_SURFACE_HEADER_CLASS,
} from './adminPanelStyles';

interface AdminCollectionToolbarProps {
  title: string;
  description?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  primaryActionHref?: string;
  itemCount?: number;
  itemCountLabel?: string;
  actions?: React.ReactNode;
}

const AdminCollectionToolbar = ({
  title,
  description,
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Buscar...',
  primaryActionLabel,
  onPrimaryAction,
  primaryActionHref,
  itemCount,
  itemCountLabel = 'itens',
  actions,
}: AdminCollectionToolbarProps) => {
  const primaryAction = primaryActionLabel ? (
    <AdminPrimaryAction label={primaryActionLabel} href={primaryActionHref} onClick={onPrimaryAction} />
  ) : null;

  return (
    <AdminToolbar>
      <div className={ADMIN_SURFACE_HEADER_CLASS}>
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
            {typeof itemCount === 'number' ? (
              <span className="rounded-sm border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                {itemCount} {itemCountLabel}
              </span>
            ) : null}
            {primaryAction}
          </div>
          {description ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
          ) : null}
        </div>
      </div>

      {(onSearchChange || actions) ? (
        <div className="flex flex-col gap-3 border-t border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900 lg:flex-row lg:items-center lg:justify-between">
          {onSearchChange ? (
            <AdminSearch value={searchValue} onChange={onSearchChange} placeholder={searchPlaceholder} />
          ) : (
            <div />
          )}
          {actions ? <AdminFilters>{actions}</AdminFilters> : null}
        </div>
      ) : null}
    </AdminToolbar>
  );
};

export default AdminCollectionToolbar;
