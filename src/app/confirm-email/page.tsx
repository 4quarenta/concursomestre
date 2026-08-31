'use client';

/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

import React, { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, CheckCircle2, Gift, Loader2, XCircle } from 'lucide-react';
import { useAuth } from '@providers/AuthProvider';
import { useToast } from '@providers/ToastProvider';
import { authFlowService } from '@services/auth/authFlowService';
import { readApiErrorMessage } from '@services/api/response';
import { getCurrentUserSnapshot } from '@services/auth/session';
import PublicBrandLink from '../../components/shared/layout/PublicBrandLink';

const pageCopy = {
  loading: 'Verificando seu e-mail...',
  successFallback: 'E-mail verificado com sucesso!',
  missingToken: 'Token de verificacao invalido ou ausente da URL.',
  pendingConfirmation: 'Confirme seu e-mail para desbloquear todos os recursos.',
  connectionFallback: 'Erro de conexao com o servidor. O link pode ter expirado.',
};

const resolvePostConfirmationPath = (): string => {
  const redirectAfterLogin = window.sessionStorage.getItem('redirectAfterLogin');

  if (redirectAfterLogin && redirectAfterLogin !== '/auth') {
    window.sessionStorage.removeItem('redirectAfterLogin');
    return redirectAfterLogin;
  }

  const currentUserSnapshot = getCurrentUserSnapshot();
  return currentUserSnapshot ? '/' : '/auth?mode=login';
};

const navigateWithCanonicalExit = (router: ReturnType<typeof useRouter>, path: string) => {
  router.replace(path);
};

const Page: React.FC = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { currentUser, refreshUser, isLoading: authLoading } = useAuth();
  const { addToast } = useToast();
  const token = searchParams.get('token');
  const hasFetched = useRef(false);
  const currentUserRef = useRef(currentUser);

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState(pageCopy.loading);
  const [xpGained, setXpGained] = useState(0);
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  useEffect(() => {
    if (token || authLoading) {
      return undefined;
    }

    const frameId = window.requestAnimationFrame(() => {
      if (currentUser && !currentUser.emailVerified) {
        setStatus('loading');
        setMessage(pageCopy.pendingConfirmation);
        return;
      }

      setStatus('error');
      setMessage(pageCopy.missingToken);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [authLoading, currentUser, token]);

  useEffect(() => {
    if (!token) {
      return undefined;
    }

    if (hasFetched.current) {
      return undefined;
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
        addToast('Conta ativada! Você ganhou bônus de XP.', 'success');

        if (currentUserRef.current) {
          await refreshUser();
        }

        const nextPath = resolvePostConfirmationPath();

        timer = setInterval(() => {
          setCountdown((previousCountdown) => {
            if (previousCountdown <= 1) {
              if (timer) {
                clearInterval(timer);
              }

          navigateWithCanonicalExit(router, nextPath);
              return 0;
            }

            return previousCountdown - 1;
          });
        }, 1000);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        const errorMessage = readApiErrorMessage(error, pageCopy.connectionFallback);
        setStatus('error');
        setMessage(errorMessage);
        setCountdown(0);
        addToast(errorMessage, 'error');
      }
    };

    void confirmEmail();

    return () => {
      isMounted = false;
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [addToast, refreshUser, router, token]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
      <PublicBrandLink
        className="mb-8 inline-flex items-center transition-opacity hover:opacity-90"
        width={220}
        priority
      />

      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xl dark:border-slate-800 dark:bg-slate-900 animate-scale-in">
        {status === 'loading' && (
          <div className="flex flex-col items-center space-y-6 py-8">
            {!token && currentUser && !currentUser.emailVerified ? (
              <>
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 ring-4 ring-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 dark:ring-indigo-900/30">
                  <CheckCircle2 size={40} />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">
                    Bem-vindo(a) ao Time!
                  </h2>
                  <p className="mx-auto max-w-xs text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                    Enviamos um link de confirmação para <strong>{currentUser.email}</strong>. Confirme para desbloquear questões, simulados e rankings.
                  </p>
                </div>
                <div className="w-full space-y-3 pt-2">
                  <button
                    onClick={() => navigateWithCanonicalExit(router, '/')}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 text-xs font-black uppercase tracking-widest text-white shadow-lg transition-all hover:bg-indigo-700 active:scale-95"
                  >
                    Ir para Dashboard <ArrowRight size={16} />
                  </button>
                  <button
                    onClick={() => navigateWithCanonicalExit(router, '/')}
                    className="w-full py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 transition-all hover:text-indigo-600 dark:hover:text-indigo-400"
                  >
                    Pular por enquanto
                  </button>
                </div>
              </>
            ) : (
              <>
                <Loader2 size={48} className="animate-spin text-indigo-600 dark:text-indigo-400" />
                <p className="font-medium text-slate-600 dark:text-slate-400">{message}</p>
              </>
            )}
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center space-y-5 py-4 animate-fade-in">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-4 ring-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:ring-emerald-900/30">
              <CheckCircle2 size={40} />
            </div>

            <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">
              Conta ativada!
            </h2>

            <p className="max-w-xs text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              {message}
            </p>

            {xpGained > 0 && (
              <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-bold text-amber-600 shadow-sm dark:border-amber-800 dark:bg-amber-900/10 dark:text-amber-400">
                <Gift size={16} />
                +{xpGained} XP de bônus recebido!
              </div>
            )}

            <div className="w-full space-y-3 pt-2">
              <p className="text-xs font-medium text-slate-400 dark:text-slate-500">
                Redirecionando automaticamente em <span className="font-black text-indigo-500">{countdown}s</span>...
              </p>
              <button
            onClick={() => navigateWithCanonicalExit(router, resolvePostConfirmationPath())}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 text-xs font-black uppercase tracking-widest text-white shadow-lg transition-all hover:bg-indigo-700 active:scale-95"
              >
                Continuar na Plataforma <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center space-y-5 py-4 animate-fade-in">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400">
              <XCircle size={40} />
            </div>

            <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">
              Ops, ocorreu um erro
            </h2>

            <div
              role="alert"
              aria-live="assertive"
              className="w-full rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-left text-sm font-semibold leading-relaxed text-red-700 shadow-sm dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200"
            >
              {message}
            </div>

            <button
              onClick={() => navigateWithCanonicalExit(router, currentUser ? '/' : '/auth?mode=login')}
              className="mt-4 flex h-12 w-full items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 text-xs font-black uppercase tracking-widest text-slate-900 shadow-sm transition-all hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            >
              {currentUser ? 'Voltar ao inicio' : 'Voltar para o login'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Page;
