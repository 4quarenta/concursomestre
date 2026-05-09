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

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
} from 'lucide-react';
import { readApiErrorMessage } from '@services/api';
import { authFlowService } from '@services/auth';
import { useAuth } from '@providers/AuthProvider';
import { useAppConfigStore } from '@/state/app-config/appConfigStore';
import { useRecaptchaV3 } from '@services/system/useRecaptchaV3';
import PublicBrandLink from '../../components/shared/layout/PublicBrandLink';

const ResetPasswordPage: React.FC = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');
  const emailFromUrl = searchParams.get('email');
  const { currentUser } = useAuth();
  const systemSettings = useAppConfigStore((state) => state.systemSettings);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const recaptchaEnabled = !!systemSettings?.recaptchaEnabled && !!systemSettings?.recaptchaSiteKey;
  const { executeRecaptcha } = useRecaptchaV3({
    enabled: recaptchaEnabled,
    siteKey: systemSettings?.recaptchaSiteKey,
  });

  useEffect(() => {
    let frameId: number | null = null;

    if (!token) {
      frameId = window.requestAnimationFrame(() => {
        setError('Token de redefinicao ausente. Solicite um novo link.');
      });
    } else if (currentUser && emailFromUrl && currentUser.email !== emailFromUrl) {
      frameId = window.requestAnimationFrame(() => {
        setError('Este link de redefinicao pertence a outra conta. Faca logout ou use a conta correta.');
      });
    }

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [token, currentUser, emailFromUrl]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!token) {
      return;
    }

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas nao coincidem.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const captchaToken = recaptchaEnabled
        ? await executeRecaptcha('auth_reset_password')
        : null;

      await authFlowService.resetPassword({
        token,
        password,
        captchaToken,
      });

      setSuccess(true);
    } catch (requestError) {
      setError(readApiErrorMessage(requestError, 'Erro de conexao com o servidor.'));
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-slate-950 dark:to-slate-900 p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl p-10 text-center space-y-5 border border-slate-100 dark:border-slate-800 animate-scale-in">
          <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 size={40} />
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Senha alterada!</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
            Sua senha foi redefinida com sucesso. Voce ja pode acessar sua conta com a nova senha.
          </p>
          <button
            onClick={() => router.push('/auth?mode=login')}
            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold text-xs tracking-widest uppercase hover:bg-indigo-700 shadow-lg shadow-indigo-200 dark:shadow-none transition-all"
          >
            Ir para o login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50/30 dark:from-slate-950 dark:to-slate-900 p-6">
      <div className="w-full max-w-md">
        <PublicBrandLink
          className="mb-10 inline-flex items-center justify-center transition-opacity hover:opacity-90"
          width={220}
          priority
        />

        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-xl border border-slate-200 dark:border-slate-800 p-8 sm:p-10 animate-scale-in">
          <div className="mb-8">
            <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-3">
              <KeyRound size={28} className="text-indigo-600" />
              Nova senha
            </h2>
            <p className="text-slate-400 dark:text-slate-500 text-xs mt-1.5 font-medium">
              Crie uma senha forte e segura para sua conta.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-0.5">Senha</label>
              <div className="relative">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoFocus
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full h-12 pl-10 pr-12 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-slate-100 font-semibold text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600"
                  placeholder="Minimo 6 caracteres"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-0.5">Confirmar senha</label>
              <div className="relative">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="w-full h-12 pl-10 pr-12 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-slate-100 font-semibold text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600"
                  placeholder="Repita a senha"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2.5 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-xs font-bold border border-red-100 dark:border-red-900/30">
                <AlertCircle size={14} className="flex-shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !token}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-black rounded-2xl text-xs uppercase tracking-[0.2em] transition-all shadow-lg shadow-indigo-200 dark:shadow-none disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {isLoading ? <Loader2 size={20} className="animate-spin" /> : 'Redefinir senha'}
            </button>

            <Link href="/auth?mode=login" className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all justify-center uppercase tracking-widest pt-2">
              <ArrowLeft size={14} /> Voltar ao login
            </Link>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
