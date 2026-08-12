import React from 'react';
import {
  ADMIN_SURFACE_CLASS,
  ADMIN_SURFACE_HEADER_CLASS,
} from './adminPanelStyles';

interface AdminCollectionTablePanelProps {
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

const AdminCollectionTablePanel = ({
  title,
  children,
  actions,
  className = '',
}: AdminCollectionTablePanelProps) => (
  <section className={`${ADMIN_SURFACE_CLASS} overflow-hidden ${className}`}>
    <header className={`${ADMIN_SURFACE_HEADER_CLASS} flex min-h-12 items-center justify-between gap-3`}>
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
    <div className="overflow-x-auto">{children}</div>
  </section>
);

export default AdminCollectionTablePanel;
