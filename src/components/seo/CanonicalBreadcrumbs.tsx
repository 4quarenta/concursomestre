import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { assertCanonicalBreadcrumbItems, assertCanonicalPath, type CanonicalBreadcrumbItem } from '@services/seo/structuredData';

export default function CanonicalBreadcrumbs({
  items,
  className = '',
}: {
  items: readonly CanonicalBreadcrumbItem[];
  className?: string;
}) {
  if (items.length < 2) return null;
  const canonicalItems = assertCanonicalBreadcrumbItems(items)
    .map((item) => ({ ...item, path: assertCanonicalPath(item.path) }));

  return (
    <nav
      data-breadcrumbs
      data-canonical-current={canonicalItems[canonicalItems.length - 1]?.path}
      aria-label="Breadcrumb"
      className={`min-w-0 overflow-x-auto ${className}`.trim()}
    >
      <ol className="flex min-w-max items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400">
        {canonicalItems.map((item, index) => {
          const current = index === canonicalItems.length - 1;
          return (
            <li key={`${item.path}-${index}`} className="flex min-w-0 items-center gap-1.5">
              {index > 0 ? <ChevronRight size={12} aria-hidden="true" className="shrink-0" /> : null}
              {current ? (
                <span aria-current="page" className="max-w-[70vw] truncate text-slate-700 dark:text-slate-200 sm:max-w-[32rem]">
                  {item.label}
                </span>
              ) : (
                <Link href={item.path} prefetch={false} className="whitespace-nowrap hover:text-[#615fff] hover:underline">
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
