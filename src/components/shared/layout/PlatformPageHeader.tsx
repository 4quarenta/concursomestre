import type { ReactNode } from 'react';
import CanonicalBreadcrumbs from '@/components/seo/CanonicalBreadcrumbs';
import type { CanonicalBreadcrumbItem } from '@services/seo/structuredData';

type PlatformPageHeaderProps = {
  title: string;
  description?: ReactNode;
  breadcrumbs?: readonly CanonicalBreadcrumbItem[];
  eyebrow?: string;
  actions?: ReactNode;
  footer?: ReactNode;
  className?: string;
  practiceHeader?: boolean;
};

export default function PlatformPageHeader({
  title,
  description,
  breadcrumbs,
  eyebrow,
  actions,
  footer,
  className = '',
  practiceHeader = false,
}: PlatformPageHeaderProps) {
  return (
    <header className={`space-y-2 pb-3 ${className}`.trim()} data-platform-page-header data-semantic-content data-practice-semantic-header={practiceHeader || undefined}>
      {breadcrumbs ? <CanonicalBreadcrumbs items={breadcrumbs} /> : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow ? <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-700 dark:text-indigo-300">{eyebrow}</p> : null}
          <h1 className="text-2xl font-bold leading-[1.25] text-slate-900 dark:text-slate-100 sm:text-[28px]">{title}</h1>
          {description ? <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-slate-600 dark:text-slate-300">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {footer ? <div>{footer}</div> : null}
    </header>
  );
}
