'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, CheckCircle2, Gift, Loader2, XCircle } from 'lucide-react';
import BrandLink from '@/components/shared/BrandLink';
import { useAuthSession } from '@/components/auth/AuthSessionProvider';
import { authFlowService } from '@/services/auth/authFlowService';
import { readApiErrorMessage } from '@/lib/browserApi';

const AUTH_REDIRECT_STORAGE_KEY = 'redirectAfterLogin';

type ConfirmEmailClientProps = {
  redirectTo: string | null;
  token: string | null;
};

const pageCopy = {
  loading: 'Verificando seu e-mail...',
  successFallback: 'E-mail verificado com sucesso!',
  missingToken: 'Token de verificacao invalido ou ausente da URL.',
  connectionFallback: 'Erro de conexao com o servidor. O link pode ter expirado.',
};

const resolvePostConfirmationPath = (redirectFromQuery: string | null) => {
  if (redirectFromQuery && redirectFromQuery.startsWith('/') && !redirectFromQuery.startsWith('/auth')) {
    return redirectFromQuery;
  }

  if (typeof window !== 'undefined') {
    const redirectAfterLogin = sessionStorage.getItem(AUTH_REDIRECT_STORAGE_KEY);
    if (redirectAfterLogin && redirectAfterLogin.startsWith('/') && !redirectAfterLogin.startsWith('/auth')) {
      sessionStorage.removeItem(AUTH_REDIRECT_STORAGE_KEY);
      return redirectAfterLogin;
    }
  }

  return '/auth?mode=login';
};

export default function ConfirmEmailClient({ redirectTo, token }: ConfirmEmailClientProps) {
  const router = useRouter();
  const hasFetched = useRef(false);
  const { currentUser, refreshUser, isLoading: authLoading } = useAuthSession();

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState(pageCopy.loading);
  const [xpGained, setXpGained] = useState(0);
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (!token) {
      if (authLoading) {
        return;
      }

      setStatus('error');
      setMessage(pageCopy.missingToken);
      return;
    }

    if (hasFetched.current) {
      return;
    }

    hasFetched.current = true;
    let isMounted = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    const confirmEmail = async () => {
      try {
        const result = await authFlowService.confirmEmail(token);

        if (!isMounted) {
          return;
        }

        setStatus('success');
        setMessage(result.message || pageCopy.successFallback);
        setXpGained(result.newXp > 0 ? result.newXp : 50);

        if (currentUser) {
          await refreshUser();
        }

        const nextPath = currentUser ? resolvePostConfirmationPath(redirectTo) : '/auth?mode=login';

        timer = setInterval(() => {
          setCountdown((currentCountdown) => {
            if (currentCountdown <= 1) {
              if (timer) {
                clearInterval(timer);
              }

              router.replace(nextPath);
              return 0;
            }

            return currentCountdown - 1;
          });
        }, 1000);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setStatus('error');
        setMessage(readApiErrorMessage(error, pageCopy.connectionFallback));
        setCountdown(0);
      }
    };

    void confirmEmail();

    return () => {
      isMounted = false;
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [authLoading, currentUser, redirectTo, refreshUser, router, token]);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 dark:bg-slate-950">
      <div className="mx-auto flex min-h-[85vh] max-w-md flex-col items-center justify-center">
        <BrandLink className="mb-8" />

        <div className="w-full rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-xl dark:border-slate-800 dark:bg-slate-900">
          {status === 'loading' ? (
            <div className="flex flex-col items-center space-y-6 py-8">
              <Loader2 size={48} className="animate-spin text-indigo-600 dark:text-indigo-400" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{message}</p>
            </div>
          ) : null}

          {status === 'success' ? (
            <div className="flex flex-col items-center space-y-5 py-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-4 ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/10">
                <CheckCircle2 size={40} />
              </div>

              <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100">Conta ativada</h1>
              <p className="max-w-xs text-sm leading-7 text-slate-500 dark:text-slate-400">{message}</p>

              {xpGained > 0 ? (
                <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-bold text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
                  <Gift size={16} />
                  +{xpGained} XP de bonus
                </div>
              ) : null}

              <div className="w-full space-y-3 pt-2">
                <p className="text-xs font-medium text-slate-400 dark:text-slate-500">
                  Redirecionando em <span className="font-black text-indigo-500">{countdown}s</span>...
                </p>
                <button
                  type="button"
                  onClick={() => router.replace(currentUser ? resolvePostConfirmationPath(redirectTo) : '/auth?mode=login')}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 text-xs font-black uppercase tracking-[0.18em] text-white transition-colors hover:bg-indigo-700"
                >
                  Continuar
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          ) : null}

          {status === 'error' ? (
            <div className="flex flex-col items-center space-y-5 py-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300">
                <XCircle size={40} />
              </div>

              <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100">Ops, ocorreu um erro</h1>
              <div className="w-full rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-left text-sm font-semibold leading-7 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
                {message}
              </div>

              <button
                type="button"
                onClick={() => router.replace(currentUser ? '/' : '/auth?mode=login')}
                className="inline-flex h-12 w-full items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 text-xs font-black uppercase tracking-[0.18em] text-slate-900 transition-colors hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
              >
                {currentUser ? 'Voltar ao inicio' : 'Voltar para o login'}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
