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
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, BrainCircuit, CheckCircle2, Gift, Loader2, XCircle } from 'lucide-react';
import { useAuth } from '@providers/AuthProvider';
import { useToast } from '@providers/ToastProvider';
import { authFlowService } from '@services/auth/authFlowService';
import { readApiErrorMessage } from '@services/api/response';

const pageCopy = {
  loading: 'Verificando seu e-mail...',
  successFallback: 'E-mail verificado com sucesso!',
  missingToken: 'Token de verificacao invalido ou ausente da URL.',
  pendingConfirmation: 'Confirme seu e-mail para desbloquear todos os recursos.',
};

const Page: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentUser, refreshUser, isLoading: authLoading } = useAuth();
  const { addToast } = useToast();
  const token = searchParams.get('token');
  const hasFetched = useRef(false);

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState(pageCopy.loading);
  const [xpGained, setXpGained] = useState(0);
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (!token) {
      if (authLoading) {
        return;
      }

      if (currentUser && !currentUser.emailVerified) {
        setStatus('loading');
        setMessage(pageCopy.pendingConfirmation);
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
        addToast('Conta ativada! Voce ganhou bonus de XP.', 'success');

        if (currentUser) {
          await refreshUser();
        }

        timer = setInterval(() => {
          setCountdown((previousCountdown) => {
            if (previousCountdown <= 1) {
              if (timer) {
                clearInterval(timer);
              }

              navigate(currentUser ? '/' : '/auth');
              return 0;
            }

            return previousCountdown - 1;
          });
        }, 1000);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setStatus('error');
        setMessage(readApiErrorMessage(error, 'Erro de conexao com o servidor. O link pode ter expirado.'));
      }
    };

    void confirmEmail();

    return () => {
      isMounted = false;
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [addToast, authLoading, currentUser, navigate, refreshUser, token]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-xl mb-8">
        <BrainCircuit size={28} />
        <span className="tracking-tight">ConcursoMestre</span>
      </div>

      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[2rem] shadow-xl border border-slate-200 dark:border-slate-800 p-8 text-center animate-scale-in">
        {status === 'loading' && (
          <div className="py-8 space-y-6 flex flex-col items-center">
            {!token && currentUser && !currentUser.emailVerified ? (
              <>
                <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center ring-4 ring-indigo-100 dark:ring-indigo-900/30">
                  <CheckCircle2 size={40} />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">
                    Bem-vindo(a) ao Time!
                  </h2>
                  <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed max-w-xs mx-auto">
                    Enviamos um link de confirmacao para <strong>{currentUser.email}</strong>. Confirme para desbloquear questoes, simulados e rankings.
                  </p>
                </div>
                <div className="w-full space-y-3 pt-2">
                  <button
                    onClick={() => navigate('/')}
                    className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-black rounded-2xl text-xs uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2"
                  >
                    Ir para Dashboard <ArrowRight size={16} />
                  </button>
                  <button
                    onClick={() => navigate('/')}
                    className="w-full py-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 text-[10px] font-black uppercase tracking-widest transition-all"
                  >
                    Pular por enquanto
                  </button>
                </div>
              </>
            ) : (
              <>
                <Loader2 size={48} className="animate-spin text-indigo-600 dark:text-indigo-400" />
                <p className="text-slate-600 dark:text-slate-400 font-medium">{message}</p>
              </>
            )}
          </div>
        )}

        {status === 'success' && (
          <div className="py-4 space-y-5 animate-fade-in flex flex-col items-center">
            <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center ring-4 ring-emerald-100 dark:ring-emerald-900/30">
              <CheckCircle2 size={40} />
            </div>

            <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">
              Conta ativada!
            </h2>

            <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed max-w-xs">
              {message}
            </p>

            {xpGained > 0 && (
              <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 px-4 py-2 rounded-xl text-sm font-bold shadow-sm">
                <Gift size={16} />
                +{xpGained} XP de bonus recebido!
              </div>
            )}

            <div className="w-full space-y-3 pt-2">
              <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                Redirecionando automaticamente em <span className="font-black text-indigo-500">{countdown}s</span>...
              </p>
              <button
                onClick={() => navigate(currentUser ? '/' : '/auth')}
                className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-black rounded-2xl text-xs uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2"
              >
                {currentUser ? 'Continuar na Plataforma' : 'Fazer Login'} <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="py-4 space-y-5 animate-fade-in flex flex-col items-center">
            <div className="w-20 h-20 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center">
              <XCircle size={40} />
            </div>

            <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">
              Ops, ocorreu um erro
            </h2>

            <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed max-w-xs">
              {message}
            </p>

            <button
              onClick={() => (currentUser ? navigate('/') : navigate('/auth?mode=login'))}
              className="mt-4 w-full h-12 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 font-black rounded-2xl text-xs uppercase tracking-widest transition-all shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-center"
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
