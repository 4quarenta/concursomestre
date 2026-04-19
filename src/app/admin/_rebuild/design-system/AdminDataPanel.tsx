import type { ReactNode } from 'react';

interface AdminDataPanelProps {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export default function AdminDataPanel({
  title,
  description,
  action,
  children,
  className = '',
}: AdminDataPanelProps) {
  return (
    <section className={`rounded-lg border border-[#d8e2dc] bg-white shadow-[0_18px_48px_rgba(22,33,29,0.08)] ${className}`}>
      {(title || description || action) ? (
        <header className="flex flex-col gap-3 border-b border-[#d8e2dc] px-4 py-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            {title ? <h2 className="text-base font-black text-[#16211d]">{title}</h2> : null}
            {description ? <p className="mt-1 text-sm leading-6 text-[#5f6f68]">{description}</p> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </header>
      ) : null}
      <div className="p-4">{children}</div>
    </section>
  );
}
