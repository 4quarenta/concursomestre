import type { ReactNode } from 'react';
import CanonicalBreadcrumbs from '@/components/seo/CanonicalBreadcrumbs';
import type { CanonicalBreadcrumbItem } from '@services/seo/structuredData';

type PlatformPageHeaderProps = {
  breadcrumbs: readonly CanonicalBreadcrumbItem[];
  title: string;
  description: ReactNode;
  action?: ReactNode;
};

export default function PlatformPageHeader({
  breadcrumbs,
  title,
  description,
  action,
}: PlatformPageHeaderProps) {
  return (
    <header className="grid gap-3 pb-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end" data-platform-page-header>
      <div className="min-w-0 space-y-2.5">
        <CanonicalBreadcrumbs items={breadcrumbs} />
        <div>
          <h1 className="text-2xl font-bold leading-tight text-slate-900 dark:text-slate-100 sm:text-[28px] sm:leading-[1.25]">
            {title}
          </h1>
          <p className="mt-1 max-w-[760px] text-sm leading-[1.5] text-slate-600 dark:text-slate-300">
            {description}
          </p>
        </div>
      </div>
      {action ? <div className="flex shrink-0 items-center">{action}</div> : null}
    </header>
  );
}
