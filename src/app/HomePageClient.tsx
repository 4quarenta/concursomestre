'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@providers/AuthProvider';
import LandingPage from './landing/LandingPage';

const HomePageLoadingShell = () => (
  <div className="min-h-screen bg-white dark:bg-slate-950">
    <div className="mx-auto flex min-h-screen w-full max-w-7xl items-center justify-center px-6">
      <div
        className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-500 dark:border-slate-800 dark:border-t-indigo-400"
        aria-label="Carregando plataforma"
      />
    </div>
  </div>
);

/**
 * Resolve a home no cliente depois que a sessao termina de hidratar.
 * Quando o servidor detecta cookies de auth, a rota raiz entra primeiro em shell leve
 * para evitar renderizar landing antes do dashboard do usuario logado.
 * @since 1.0.0
 */
export default function HomePageClient() {
  const router = useRouter();
  const { currentUser, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && currentUser) {
      router.replace('/dashboard');
    }
  }, [currentUser, isLoading, router]);

  if (isLoading || currentUser) {
    return <HomePageLoadingShell />;
  }

  return <LandingPage />;
}

export { HomePageLoadingShell };
