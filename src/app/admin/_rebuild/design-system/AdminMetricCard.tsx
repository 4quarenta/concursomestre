import type { ReactNode } from 'react';
import AdminStatusPill from './AdminStatusPill';
import type { AdminSeverityTokenKey } from './adminDesignTokens';

interface AdminMetricCardProps {
  label: string;
  value: string;
  description?: string;
  trend?: string;
  severity?: AdminSeverityTokenKey;
  icon?: ReactNode;
}

export default function AdminMetricCard({
  label,
  value,
  description,
  trend,
  severity = 'healthy',
  icon,
}: AdminMetricCardProps) {
  return (
    <article className="min-h-36 rounded-lg border border-[#d8e2dc] bg-white p-4 shadow-[0_18px_48px_rgba(22,33,29,0.08)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase text-[#5f6f68]">{label}</p>
          <p className="mt-3 text-3xl font-black tracking-normal text-[#16211d]">{value}</p>
        </div>
        {icon ? (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#d8e2dc] bg-[#eef4ef] text-[#0f766e]">
            {icon}
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <AdminStatusPill severity={severity} label={trend} />
        {description ? <p className="text-xs leading-5 text-[#5f6f68]">{description}</p> : null}
      </div>
    </article>
  );
}
