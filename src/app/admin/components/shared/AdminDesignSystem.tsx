/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved.
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

import React from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Loader2, Plus, Search } from 'lucide-react';
import {
  ADMIN_FIELD_CLASS,
  ADMIN_PAGE_PANEL_CLASS,
  ADMIN_PRIMARY_BUTTON_CLASS,
  ADMIN_SECONDARY_BUTTON_CLASS,
  ADMIN_SURFACE_CLASS,
  ADMIN_SURFACE_HEADER_CLASS,
} from './adminPanelStyles';

export type AdminButtonVariant = 'primary' | 'secondary' | 'utility' | 'destructive';

const BUTTON_CLASS_BY_VARIANT: Record<AdminButtonVariant, string> = {
  primary: ADMIN_PRIMARY_BUTTON_CLASS,
  secondary: ADMIN_SECONDARY_BUTTON_CLASS,
  utility: 'inline-flex items-center gap-2 rounded-sm border border-transparent px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-800',
  destructive: 'inline-flex items-center gap-2 rounded-sm border border-red-700 bg-red-700 px-3 py-2 text-xs font-semibold text-white transition-colors hover:border-red-800 hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60',
};

export interface AdminButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: AdminButtonVariant;
  icon?: React.ReactNode;
}

export const AdminButton = ({ variant = 'secondary', icon, className = '', children, ...props }: AdminButtonProps) => (
  <button {...props} className={`${BUTTON_CLASS_BY_VARIANT[variant]} ${className}`}>
    {icon}
    {children}
  </button>
);

interface AdminPrimaryActionProps {
  label: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
}

export const AdminPrimaryAction = ({ label, href, onClick, disabled = false }: AdminPrimaryActionProps) => {
  const content = <><Plus size={14} />{label}</>;

  return href ? (
    <Link href={href} prefetch={false} className={ADMIN_PRIMARY_BUTTON_CLASS} aria-disabled={disabled || undefined}>
      {content}
    </Link>
  ) : (
    <AdminButton type="button" variant="primary" icon={<Plus size={14} />} onClick={onClick} disabled={disabled}>
      {label}
    </AdminButton>
  );
};

interface AdminSearchProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
}

export const AdminSearch = ({ value = '', onChange, placeholder = 'Buscar...', label = 'Buscar' }: AdminSearchProps) => (
  <div className="relative w-full lg:max-w-sm">
    <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={15} />
    <input
      type="search"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      aria-label={label}
      className={`${ADMIN_FIELD_CLASS} h-10 w-full pl-9 text-sm`}
    />
  </div>
);

interface AdminToolbarProps {
  children: React.ReactNode;
  className?: string;
}

export const AdminToolbar = ({ children, className = '' }: AdminToolbarProps) => (
  <div className={`${ADMIN_SURFACE_CLASS} overflow-hidden ${className}`}>{children}</div>
);

export const AdminFilters = ({ children, label = 'Filtros' }: { children: React.ReactNode; label?: string }) => (
  <div className="flex flex-wrap items-center gap-2" aria-label={label}>{children}</div>
);

export const AdminSort = ({ children, label = 'Ordenacao' }: { children: React.ReactNode; label?: string }) => (
  <div className="flex items-center gap-2" aria-label={label}>{children}</div>
);

export const AdminDataTable = ({ children, label = 'Resultados', className = '' }: { children: React.ReactNode; label?: string; className?: string }) => (
  <div className={`overflow-x-auto ${className}`} role="region" aria-label={label}>{children}</div>
);

export const AdminTableColumn = ({ children, className = '', ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) => (
  <th {...props} className={`p-4 ${className}`}>{children}</th>
);

export const AdminBulkActions = ({ children, summary }: { children: React.ReactNode; summary: React.ReactNode }) => (
  <div className={`${ADMIN_PAGE_PANEL_CLASS} flex flex-col gap-3 transition-colors duration-300 lg:flex-row lg:items-center lg:justify-between`}>
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Acoes em massa</span>
      {children}
    </div>
    <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{summary}</span>
  </div>
);

export const AdminRowActions = ({ children, label = 'Acoes da linha' }: { children: React.ReactNode; label?: string }) => (
  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]" aria-label={label}>{children}</div>
);

const STATUS_STYLES = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300',
  warning: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300',
  danger: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300',
  neutral: 'border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
  info: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/40 dark:bg-sky-900/20 dark:text-sky-300',
} as const;

export const AdminStatusBadge = ({ label, tone = 'neutral' }: { label: string; tone?: keyof typeof STATUS_STYLES }) => (
  <span className={`inline-flex rounded-sm border px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLES[tone]}`}>{label}</span>
);

export const AdminLoadingState = ({ label = 'Carregando...' }: { label?: string }) => <p className="p-10 text-center text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>;
export const AdminEmptyState = ({ label = 'Nenhum resultado encontrado.' }: { label?: string }) => <p className="p-10 text-center text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>;
export const AdminErrorState = ({ label = 'Nao foi possivel carregar os dados.' }: { label?: string }) => <p className="p-10 text-center text-sm font-medium text-red-600 dark:text-red-400">{label}</p>;
export const AdminFeedback = ({ children, tone = 'info' }: { children: React.ReactNode; tone?: keyof typeof STATUS_STYLES }) => <div className={`rounded-sm border p-3 text-sm ${STATUS_STYLES[tone]}`} role={tone === 'danger' ? 'alert' : 'status'}>{children}</div>;

export const AdminPagination = ({ visibleCount, totalCount, itemLabel, page, totalPages, onPageChange }: { visibleCount: number; totalCount: number; itemLabel: string; page: number; totalPages: number; onPageChange: (page: number) => void }) => (
  <div className={`${ADMIN_PAGE_PANEL_CLASS} flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`}>
    <span className="text-sm text-slate-500 dark:text-slate-400">Mostrando {visibleCount} de {totalCount} {itemLabel}</span>
    <nav className="flex flex-wrap items-center gap-2" aria-label={`Paginacao de ${itemLabel}`}>
      <AdminButton type="button" variant="secondary" icon={<ChevronLeft size={14} />} disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Anterior</AdminButton>
      <span className="flex min-h-9 items-center px-3 text-sm font-semibold text-sky-700 dark:text-sky-300" aria-current="page">Pagina {page} de {Math.max(1, totalPages)}</span>
      <AdminButton type="button" variant="secondary" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>{'Proxima'} <ChevronRight size={14} /></AdminButton>
    </nav>
  </div>
);

export const AdminEditorShell = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => <div className={`space-y-5 ${className}`}>{children}</div>;
export const AdminEditorHeader = ({ title, description, status, actions, leading }: { title: string; description?: string; status?: React.ReactNode; actions?: React.ReactNode; leading?: React.ReactNode }) => (
  <header className={`${ADMIN_SURFACE_CLASS} overflow-hidden`}><div className={`${ADMIN_SURFACE_HEADER_CLASS} flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between`}><div className="flex min-w-0 items-start gap-3">{leading ? <div className="shrink-0">{leading}</div> : null}<div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{title}</h1>{status}</div>{description ? <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p> : null}</div></div>{actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}</div></header>
);
export const AdminEditorSidebar = ({ children }: { children: React.ReactNode }) => <aside className={`${ADMIN_SURFACE_CLASS} h-fit p-5`}>{children}</aside>;
export const AdminFormSection = ({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) => <section className={`${ADMIN_SURFACE_CLASS} overflow-hidden`}><div className={ADMIN_SURFACE_HEADER_CLASS}><h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h2>{description ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p> : null}</div><div className="p-5">{children}</div></section>;
export const AdminSaveBar = ({ children }: { children: React.ReactNode }) => <div className={`${ADMIN_SURFACE_CLASS} sticky bottom-3 z-10 flex flex-wrap items-center justify-end gap-2 p-3`}>{children}</div>;
export const AdminValidationSummary = ({ errors }: { errors: string[] }) => errors.length ? <AdminFeedback tone="danger"><ul className="list-disc space-y-1 pl-5">{errors.map((error) => <li key={error}>{error}</li>)}</ul></AdminFeedback> : null;
export const AdminDangerZone = ({ title = 'Zona de risco', children }: { title?: string; children: React.ReactNode }) => <section className="rounded-sm border border-red-200 bg-red-50/60 p-5 dark:border-red-900/50 dark:bg-red-950/20"><h2 className="text-sm font-semibold text-red-800 dark:text-red-300">{title}</h2><div className="mt-3">{children}</div></section>;
export const AdminFormField = ({ label, required = false, helpText, error, children }: { label: string; required?: boolean; helpText?: string; error?: string; children: React.ReactNode }) => <div className="space-y-2"><label className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">{label}{required ? <span className="ml-1 text-red-600" aria-hidden="true">*</span> : null}</label>{children}{helpText ? <p className="text-[11px] text-slate-500 dark:text-slate-400">{helpText}</p> : null}{error ? <p className="text-xs text-red-600 dark:text-red-400" role="alert">{error}</p> : null}</div>;

export { default as AdminConfirmDialog } from '../ui/AdminConfirmDialog';

export const AdminSavingIndicator = ({ label = 'Salvando...' }: { label?: string }) => <span className="inline-flex items-center gap-2 text-xs text-slate-500"><Loader2 size={14} className="animate-spin" />{label}</span>;
