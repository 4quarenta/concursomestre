'use client';

import React, { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  User,
  UserPlus,
} from 'lucide-react';
import BrandLink from '@/components/shared/BrandLink';
import { useAuthSession } from '@/components/auth/AuthSessionProvider';
import { authFlowService } from '@/services/auth/authFlowService';
import type { SystemSettings } from '@/types';
import { readApiErrorMessage } from '@/lib/browserApi';

const ReCAPTCHA = dynamic(() => import('react-google-recaptcha'), { ssr: false });

type AuthMode = 'login' | 'signup' | 'forgot' | 'forgot-success' | 'two-factor';
type NoticeTone = 'success' | 'error' | 'warning';

const AUTH_REDIRECT_STORAGE_KEY = 'redirectAfterLogin';

type AuthPageClientProps = {
  initialMode: AuthMode;
  redirectTo: string | null;
  referralCode: string | null;
  systemSettings: SystemSettings;
};

const resolveSafeNextPath = (rawPath: string | null | undefined) => {
  if (!rawPath || !rawPath.startsWith('/')) {
    return '/';
  }

  if (rawPath.startsWith('/auth')) {
    return '/';
  }

  return rawPath;
};

const buildLoginExitPath = (redirectTo: string | null) => {
  const redirectFromQuery = resolveSafeNextPath(redirectTo);
  if (redirectFromQuery !== '/') {
    return redirectFromQuery;
  }

  if (typeof window === 'undefined') {
    return '/';
  }

  const redirectFromStorage = resolveSafeNextPath(sessionStorage.getItem(AUTH_REDIRECT_STORAGE_KEY));
  if (redirectFromStorage !== '/') {
    sessionStorage.removeItem(AUTH_REDIRECT_STORAGE_KEY);
    return redirectFromStorage;
  }

  return '/';
};

const buildNoticeClassName = (tone: NoticeTone) => {
  if (tone === 'success') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300';
  }

  if (tone === 'warning') {
    return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300';
  }

  return 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300';
};

export default function AuthPageClient({
  initialMode,
  redirectTo,
  referralCode,
  systemSettings,
}: AuthPageClientProps) {
  const router = useRouter();
  const { currentUser, isAuthenticated, isLoading: authLoading, login } = useAuthSession();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ tone: NoticeTone; message: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [twoFactorEmail, setTwoFactorEmail] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [captchaTheme, setCaptchaTheme] = useState<'light' | 'dark'>('light');
  const [captchaRenderKey, setCaptchaRenderKey] = useState(0);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    termsAccepted: false,
    forgotEmail: '',
  });

  const registrationEnabled = systemSettings.features.registrationEnabled !== false;
  const recaptchaEnabled = Boolean(systemSettings.recaptchaEnabled && systemSettings.recaptchaSiteKey);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const syncTheme = () => {
      setCaptchaTheme(mediaQuery.matches ? 'dark' : 'light');
    };

    syncTheme();
    mediaQuery.addEventListener('change', syncTheme);

    return () => {
      mediaQuery.removeEventListener('change', syncTheme);
    };
  }, []);

  useEffect(() => {
    setCaptchaToken(null);
    setCaptchaRenderKey((currentKey) => currentKey + 1);
  }, [mode]);

  useEffect(() => {
    if (authLoading || !isAuthenticated || !currentUser) {
      return;
    }

    router.replace(buildLoginExitPath(redirectTo));
  }, [authLoading, currentUser, isAuthenticated, redirectTo, router]);

  const updateField = (field: keyof typeof formData, value: string | boolean) => {
    setFormData((currentData) => ({
      ...currentData,
      [field]: value,
    }));
    setNotice(null);
  };

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setNotice(null);
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const setErrorNotice = (message: string) => {
    setNotice({ tone: 'error', message });
  };

  const requireCaptchaIfNeeded = () => {
    if (!recaptchaEnabled) {
      return true;
    }

    if (captchaToken) {
      return true;
    }

    setNotice({ tone: 'warning', message: 'Complete o desafio de seguranca para continuar.' });
    return false;
  };

  const handleLogin = async () => {
    if (!formData.email || !formData.password) {
      setErrorNotice('Preencha e-mail e senha.');
      return;
    }

    if (!requireCaptchaIfNeeded()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await authFlowService.login({
        email: formData.email,
        password: formData.password,
        captchaToken,
      });

      if (result.require2FA) {
        setTwoFactorEmail(result.email || formData.email);
        setMode('two-factor');
        setNotice(null);
        return;
      }

      await login(result.token ?? null, result.user ?? null);
      router.replace(buildLoginExitPath(redirectTo));
    } catch (error) {
      setErrorNotice(readApiErrorMessage(error, 'Nao foi possivel realizar o login.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async () => {
    if (!registrationEnabled) {
      setErrorNotice('Cadastros estao temporariamente suspensos.');
      return;
    }

    if (!formData.name.trim()) {
      setErrorNotice('Informe seu nome.');
      return;
    }

    if (!formData.email.trim()) {
      setErrorNotice('Informe seu e-mail.');
      return;
    }

    if (formData.password.length < 6) {
      setErrorNotice('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setErrorNotice('As senhas nao coincidem.');
      return;
    }

    if (!formData.termsAccepted) {
      setErrorNotice('Aceite os termos de uso para continuar.');
      return;
    }

    if (!requireCaptchaIfNeeded()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await authFlowService.register({
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password,
        captchaToken,
        referralCode,
      });

      await login(result.token ?? null, result.user ?? null);
      router.replace(buildLoginExitPath(redirectTo));
    } catch (error) {
      setErrorNotice(readApiErrorMessage(error, 'Nao foi possivel criar a conta.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!formData.forgotEmail.trim()) {
      setErrorNotice('Informe seu e-mail.');
      return;
    }

    if (!requireCaptchaIfNeeded()) {
      return;
    }

    setIsSubmitting(true);

    try {
      await authFlowService.forgotPassword({
        email: formData.forgotEmail.trim(),
        captchaToken,
      });

      setNotice({
        tone: 'success',
        message: 'Se o e-mail estiver cadastrado, enviaremos as instrucoes em instantes.',
      });
      setMode('forgot-success');
    } catch (error) {
      setErrorNotice(readApiErrorMessage(error, 'Nao foi possivel processar a solicitacao.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerify2FA = async () => {
    if (twoFactorCode.trim().length < 6) {
      setErrorNotice('Informe o codigo de 6 digitos.');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await authFlowService.verifyTwoFactor({
        email: twoFactorEmail,
        code: twoFactorCode.trim(),
      });

      await login(result.token ?? null, null);
      router.replace(buildLoginExitPath(redirectTo));
    } catch (error) {
      setErrorNotice(readApiErrorMessage(error, 'Nao foi possivel validar o codigo.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (mode === 'login') {
      void handleLogin();
      return;
    }

    if (mode === 'signup') {
      void handleRegister();
      return;
    }

    if (mode === 'forgot') {
      void handleForgotPassword();
      return;
    }

    if (mode === 'two-factor') {
      void handleVerify2FA();
    }
  };

  const isSignup = mode === 'signup';
  const isForgot = mode === 'forgot';
  const isForgotSuccess = mode === 'forgot-success';
  const isTwoFactor = mode === 'two-factor';

  const actionLabel = useMemo(() => {
    if (isForgot) {
      return 'Enviar instrucoes';
    }

    if (isSignup) {
      return 'Criar conta gratis';
    }

    return 'Entrar na plataforma';
  }, [isForgot, isSignup]);

  if (isForgotSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 px-4 py-10 dark:from-slate-950 dark:to-slate-900">
        <div className="mx-auto flex min-h-[80vh] max-w-md items-center justify-center">
          <div className="w-full rounded-[2.5rem] border border-slate-200 bg-white p-10 text-center shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
              <CheckCircle2 size={40} />
            </div>
            <h1 className="mt-6 text-2xl font-black text-slate-900 dark:text-slate-100">E-mail enviado</h1>
            <p className="mt-3 text-sm font-medium leading-7 text-slate-500 dark:text-slate-400">
              Se o endereco <strong className="text-slate-700 dark:text-slate-200">{formData.forgotEmail}</strong> estiver cadastrado,
              voce recebera as instrucoes para redefinir sua senha em breve.
            </p>
            <button
              type="button"
              onClick={() => switchMode('login')}
              className="mt-8 inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-4 py-4 text-xs font-black uppercase tracking-[0.18em] text-white transition-colors hover:bg-indigo-600 dark:bg-indigo-600 dark:hover:bg-indigo-500"
            >
              Voltar para o login
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isTwoFactor) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 px-4 py-10 dark:from-slate-950 dark:to-slate-900">
        <div className="mx-auto flex min-h-[80vh] max-w-md items-center justify-center">
          <div className="w-full rounded-[2.5rem] border border-slate-200 bg-white p-10 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
                <ShieldCheck size={32} />
              </div>
              <h1 className="mt-5 text-2xl font-black text-slate-900 dark:text-slate-100">Verificacao em duas etapas</h1>
              <p className="mt-3 text-sm font-medium leading-7 text-slate-500 dark:text-slate-400">
                Informe o codigo de 6 digitos do aplicativo autenticador para <strong>{twoFactorEmail}</strong>.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <input
                type="text"
                maxLength={6}
                autoFocus
                value={twoFactorCode}
                onChange={(event) => {
                  setTwoFactorCode(event.target.value.replace(/\D/g, ''));
                  setNotice(null);
                }}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-center text-4xl font-black tracking-[0.28em] text-slate-900 outline-none transition-colors focus:border-indigo-500 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                placeholder="000000"
              />

              {notice ? (
                <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${buildNoticeClassName(notice.tone)}`}>
                  {notice.message}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-4 text-xs font-black uppercase tracking-[0.18em] text-white transition-colors hover:bg-indigo-600 disabled:opacity-60 dark:bg-indigo-600 dark:hover:bg-indigo-500"
              >
                {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : 'Verificar e entrar'}
              </button>

              <button
                type="button"
                onClick={() => switchMode('login')}
                className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-200 px-4 py-3 text-xs font-black uppercase tracking-[0.18em] text-slate-500 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900"
              >
                Voltar ao login
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/40 dark:from-slate-950 dark:to-slate-900">
      <div className="grid min-h-screen lg:grid-cols-[0.95fr_1.05fr]">
        <aside className="hidden bg-[linear-gradient(135deg,#111827_0%,#312e81_45%,#1e293b_100%)] px-12 py-16 text-white lg:flex lg:flex-col lg:justify-center">
          <div className="max-w-md">
            <BrandLink className="text-white [&>span:last-child]:text-white" iconSize={22} />
            <h1 className="mt-10 text-5xl font-black leading-tight">
              Conta unica para estudar, acompanhar seu progresso e evoluir no ritmo certo.
            </h1>
            <p className="mt-6 text-base font-medium leading-8 text-slate-300">
              Entre para acessar questoes, simulados, ranking, materiais e toda a base viva da plataforma em Next.
            </p>
            <div className="mt-10 space-y-4 text-sm font-semibold text-slate-200">
              <p>Banco de questoes e trilhas por objetivo.</p>
              <p>Simulados, ranking e leitura de materiais.</p>
              <p>Fluxo de conta centralizado sem depender do legado.</p>
            </div>
          </div>
        </aside>

        <main className="flex items-center justify-center px-4 py-8 sm:px-8 lg:px-12">
          <div className="w-full max-w-md">
            <div className="mb-8 flex justify-center lg:hidden">
              <BrandLink />
            </div>

            <div className="rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-xl dark:border-slate-800 dark:bg-slate-900 sm:p-10">
              {isForgot ? (
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="mb-6 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-slate-400 transition-colors hover:text-indigo-600 dark:hover:text-indigo-400"
                >
                  <ArrowLeft size={14} />
                  Voltar
                </button>
              ) : null}

              <div className="mb-8">
                <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100">
                  {isForgot ? 'Recuperar senha' : isSignup ? 'Criar conta' : 'Entrar'}
                </h1>
                <p className="mt-2 text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">
                  {isForgot
                    ? 'Informe seu e-mail e enviaremos o link de recuperacao.'
                    : isSignup
                      ? 'Seu acesso agora ja nasce na base Next da plataforma.'
                      : 'Use sua conta para acessar a plataforma.'}
                </p>
              </div>

              {isSignup && !registrationEnabled ? (
                <div className="rounded-[2rem] border border-amber-200 bg-amber-50 px-6 py-8 text-center dark:border-amber-500/20 dark:bg-amber-500/10">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                    <AlertCircle size={28} />
                  </div>
                  <h2 className="mt-4 text-lg font-black text-slate-900 dark:text-slate-100">Cadastros suspensos</h2>
                  <p className="mt-2 text-sm font-medium leading-6 text-slate-600 dark:text-slate-300">
                    No momento nao estamos aceitando novos alunos. Tente novamente mais tarde.
                  </p>
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className="mt-5 text-xs font-black uppercase tracking-[0.18em] text-indigo-600 hover:underline dark:text-indigo-300"
                  >
                    Voltar para login
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {isSignup ? (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Nome completo</label>
                      <div className="relative">
                        <User size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(event) => updateField('name', event.target.value)}
                          className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm font-semibold text-slate-900 outline-none transition-colors focus:border-indigo-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                          placeholder="Seu nome completo"
                          required
                        />
                      </div>
                    </div>
                  ) : null}

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                      {isForgot ? 'E-mail cadastrado' : 'E-mail'}
                    </label>
                    <div className="relative">
                      <Mail size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="email"
                        value={isForgot ? formData.forgotEmail : formData.email}
                        onChange={(event) => updateField(isForgot ? 'forgotEmail' : 'email', event.target.value)}
                        className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm font-semibold text-slate-900 outline-none transition-colors focus:border-indigo-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                        placeholder="exemplo@email.com"
                        required
                      />
                    </div>
                  </div>

                  {!isForgot ? (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Senha</label>
                      <div className="relative">
                        <Lock size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={formData.password}
                          onChange={(event) => updateField('password', event.target.value)}
                          className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-12 text-sm font-semibold text-slate-900 outline-none transition-colors focus:border-indigo-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                          placeholder={isSignup ? 'Minimo 6 caracteres' : 'Sua senha'}
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
                  ) : null}

                  {isSignup ? (
                    <>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Confirmar senha</label>
                        <div className="relative">
                          <Lock size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type={showConfirmPassword ? 'text' : 'password'}
                            value={formData.confirmPassword}
                            onChange={(event) => updateField('confirmPassword', event.target.value)}
                            className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-12 text-sm font-semibold text-slate-900 outline-none transition-colors focus:border-indigo-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                            placeholder="Repita a senha"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword((value) => !value)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
                          >
                            {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>

                      <label className="flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-4 dark:bg-slate-950">
                        <input
                          type="checkbox"
                          checked={formData.termsAccepted}
                          onChange={(event) => updateField('termsAccepted', event.target.checked)}
                          className="mt-1 h-4 w-4 rounded accent-indigo-600"
                        />
                        <span className="text-[11px] font-medium leading-6 text-slate-600 dark:text-slate-300">
                          Li e aceito os{' '}
                          <Link href="/terms" className="font-bold text-indigo-600 hover:underline dark:text-indigo-300">
                            Termos de Uso
                          </Link>
                          {' '}e a{' '}
                          <Link href="/privacy" className="font-bold text-indigo-600 hover:underline dark:text-indigo-300">
                            Politica de Privacidade
                          </Link>.
                        </span>
                      </label>
                    </>
                  ) : null}

                  {recaptchaEnabled ? (
                    <div className="flex justify-center py-2">
                      <ReCAPTCHA
                        key={captchaRenderKey}
                        sitekey={systemSettings.recaptchaSiteKey || ''}
                        onChange={(token) => setCaptchaToken(token)}
                        theme={captchaTheme}
                      />
                    </div>
                  ) : null}

                  {!isSignup && !isForgot ? (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => switchMode('forgot')}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 transition-colors hover:text-indigo-600 dark:hover:text-indigo-400"
                      >
                        <KeyRound size={12} />
                        Esqueci minha senha
                      </button>
                    </div>
                  ) : null}

                  {notice ? (
                    <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${buildNoticeClassName(notice.tone)}`}>
                      {notice.message}
                    </div>
                  ) : null}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-4 text-xs font-black uppercase tracking-[0.18em] text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={16} />}
                    {isSubmitting ? 'Processando...' : actionLabel}
                  </button>
                </form>
              )}

              {!isForgot ? (
                <div className="mt-8 space-y-3 text-center">
                  <p className="text-xs font-medium text-slate-400 dark:text-slate-500">
                    {isSignup ? 'Ja tem conta?' : 'Novo por aqui?'}{' '}
                    <button
                      type="button"
                      onClick={() => switchMode(isSignup ? 'login' : 'signup')}
                      className="font-black uppercase tracking-[0.16em] text-indigo-600 hover:underline dark:text-indigo-300"
                    >
                      {isSignup ? 'Fazer login' : 'Criar conta'}
                    </button>
                  </p>

                  {notice?.message.includes('nao cadastrado') ? (
                    <button
                      type="button"
                      onClick={() => {
                        updateField('email', formData.forgotEmail || formData.email);
                        switchMode('signup');
                      }}
                      className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-indigo-600 hover:underline dark:text-indigo-300"
                    >
                      <UserPlus size={14} />
                      Criar conta agora
                    </button>
                  ) : null}

                  <Link
                    href="/"
                    className="inline-flex items-center justify-center text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 transition-colors hover:text-indigo-600 dark:hover:text-indigo-400"
                  >
                    Voltar para a home
                  </Link>
                </div>
              ) : null}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
