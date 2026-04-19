import type { ReactNode } from 'react';
import AdminStatusPill from './AdminStatusPill';
import type { AdminSeverityTokenKey } from './adminDesignTokens';

interface AdminQueueRowProps {
  title: string;
  description: string;
  severity: AdminSeverityTokenKey;
  meta?: string;
  action?: ReactNode;
}

export default function AdminQueueRow({
  title,
  description,
  severity,
  meta,
  action,
}: AdminQueueRowProps) {
  return (
    <div className="grid gap-3 border-b border-[#d8e2dc] py-3 last:border-b-0 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <AdminStatusPill severity={severity} />
          {meta ? <span className="text-xs font-bold uppercase text-[#5f6f68]">{meta}</span> : null}
        </div>
        <p className="mt-2 text-sm font-black text-[#16211d]">{title}</p>
        <p className="mt-1 text-sm leading-6 text-[#5f6f68]">{description}</p>
      </div>
      {action ? <div className="md:justify-self-end">{action}</div> : null}
    </div>
  );
}
