import { adminSeverityTokens, type AdminSeverityTokenKey } from './adminDesignTokens';

interface AdminStatusPillProps {
  severity: AdminSeverityTokenKey;
  label?: string;
}

export default function AdminStatusPill({ severity, label }: AdminStatusPillProps) {
  const token = adminSeverityTokens[severity];

  return (
    <span className={`inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs font-bold ${token.className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${token.dotClassName}`} aria-hidden />
      {label || token.label}
    </span>
  );
}
