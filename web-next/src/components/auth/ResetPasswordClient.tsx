'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
import BrandLink from '@/components/shared/BrandLink';
import { authFlowService } from '@/services/auth/authFlowService';
import { readApiErrorMessage } from '@/lib/browserApi';
import { useAuthSession } from '@/components/auth/AuthSessionProvider';

type ResetPasswordClientProps = {
  emailFromUrl: string | null;
  token: string | null;
};

export default function ResetPasswordClient({ emailFromUrl, token }: ResetPasswordClientProps) {
  const router = useRouter();
  const { currentUser } = useAuthSession();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Token de redefinicao ausente. Solicite um novo link.');
      return;
    }

    if (currentUser && emailFromUrl && currentUser.email !== emailFromUrl) {
      setError('Este link de redefinicao pertence a outra conta. Faca logout ou use a conta correta.');
    }
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

    setIsSubmitting(true);
    setError('');

    try {
      await authFlowService.resetPassword({
        token,
        password,
      });
      setSuccess(true);
    } catch (requestError) {
      setError(readApiErrorMessage(requestError, 'Erro de conexao com o servidor.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 px-4 py-10 dark:from-slate-950 dark:to-slate-900">
        <div className="mx-auto flex min-h-[80vh] max-w-md items-center justify-center">
          <div className="w-full rounded-[2.5rem] border border-slate-200 bg-white p-10 text-center shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
              <CheckCircle2 size={40} />
            </div>
            <h1 className="mt-6 text-2xl font-black text-slate-900 dark:text-slate-100">Senha alterada</h1>
            <p className="mt-3 text-sm font-medium leading-7 text-slate-500 dark:text-slate-400">
              Sua senha foi redefinida com sucesso. Agora voce ja pode entrar com a nova credencial.
            </p>
            <button
              type="button"
              onClick={() => router.replace('/auth?mode=login')}
              className="mt-8 inline-flex w-full items-center justify-center rounded-2xl bg-indigo-600 px-4 py-4 text-xs font-black uppercase tracking-[0.18em] text-white transition-colors hover:bg-indigo-700"
            >
              Ir para o login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/30 px-4 py-10 dark:from-slate-950 dark:to-slate-900">
      <div className="mx-auto max-w-md">
        <div className="mb-10 flex justify-center">
          <BrandLink />
        </div>

        <div className="rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-xl dark:border-slate-800 dark:bg-slate-900 sm:p-10">
          <div className="mb-8">
            <h1 className="flex items-center gap-3 text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">
              <KeyRound size={28} className="text-indigo-600" />
              Nova senha
            </h1>
            <p className="mt-2 text-xs font-medium text-slate-400 dark:text-slate-500">
              Crie uma senha forte e segura para sua conta.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Senha</label>
              <div className="relative">
                <Lock size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-12 text-sm font-semibold text-slate-900 outline-none transition-colors focus:border-indigo-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                  placeholder="Minimo 6 caracteres"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Confirmar senha</label>
              <div className="relative">
                <Lock size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-12 text-sm font-semibold text-slate-900 outline-none transition-colors focus:border-indigo-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                  placeholder="Repita a senha"
                  required
                />
              </div>
            </div>

            {error ? (
              <div className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
                <AlertCircle size={14} className="shrink-0" />
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting || !token}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-4 text-xs font-black uppercase tracking-[0.18em] text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
            >
              {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : 'Redefinir senha'}
            </button>

            <Link
              href="/auth?mode=login"
              className="inline-flex w-full items-center justify-center gap-2 pt-2 text-xs font-black uppercase tracking-[0.18em] text-slate-400 transition-colors hover:text-indigo-600 dark:hover:text-indigo-400"
            >
              <ArrowLeft size={14} />
              Voltar ao login
            </Link>
          </form>
        </div>
      </div>
    </div>
  );
}
