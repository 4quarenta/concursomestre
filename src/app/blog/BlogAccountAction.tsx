'use client';

import Link from 'next/link';
import { useAuth } from '@/providers/AuthProvider';

export default function BlogAccountAction() {
  const { currentUser, isLoading } = useAuth();

  if (isLoading) {
    return <span className="h-10 w-24 animate-pulse rounded-md bg-slate-100 dark:bg-slate-800" aria-hidden="true" />;
  }

  return (
    <Link
      href={currentUser ? '/dashboard' : '/auth'}
      className="inline-flex h-10 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-bold text-white transition-colors hover:bg-indigo-700 dark:bg-white dark:text-slate-950 dark:hover:bg-indigo-100"
    >
      {currentUser ? 'Minha conta' : 'Entrar'}
    </Link>
  );
}
