import type { ReactNode } from 'react';

interface AdminEmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
}

export default function AdminEmptyState({ title, description, action }: AdminEmptyStateProps) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center rounded-lg border border-dashed border-[#d8e2dc] bg-[#f8faf9] px-6 py-8 text-center">
      <p className="text-base font-black text-[#16211d]">{title}</p>
      <p className="mt-2 max-w-xl text-sm leading-6 text-[#5f6f68]">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
