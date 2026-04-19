import type { ReactNode } from 'react';

interface AdminSectionHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}

export default function AdminSectionHeader({
  eyebrow,
  title,
  description,
  actions,
}: AdminSectionHeaderProps) {
  return (
    <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="max-w-3xl">
        {eyebrow ? <p className="text-xs font-black uppercase text-[#0f766e]">{eyebrow}</p> : null}
        <h1 className="mt-2 text-3xl font-black tracking-normal text-[#16211d] md:text-4xl">{title}</h1>
        {description ? <p className="mt-3 text-base leading-7 text-[#5f6f68]">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
