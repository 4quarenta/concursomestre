'use client';

import Link from 'next/link';
import { GraduationCap } from 'lucide-react';

type BrandLinkProps = {
  className?: string;
  iconSize?: number;
};

export default function BrandLink({
  className = '',
  iconSize = 24,
}: BrandLinkProps) {
  return (
    <Link
      href="/"
      className={`inline-flex items-center gap-3 font-black tracking-tight text-slate-900 transition-opacity hover:opacity-90 dark:text-white ${className}`.trim()}
    >
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none">
        <GraduationCap size={iconSize} />
      </span>
      <span className="text-xl">ConcursoMestre</span>
    </Link>
  );
}
