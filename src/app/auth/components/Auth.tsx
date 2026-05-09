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
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Bookmark,
  CheckCircle2,
  CircleHelp,
  Clock3,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Search,
  ShieldCheck,
  TrendingUp,
  User,
  UserPlus,
} from 'lucide-react';
import Link from 'next/link';
import Script from 'next/script';
import type { UserProfile } from '@types';
import { useAppConfigStore } from '@/state/app-config/appConfigStore';
import { apiClient, ENDPOINTS, readApiErrorMessage } from '@services/api';
import analyticsTrackingService from '@services/analytics/analyticsTrackingService';
import { authFlowService, canAccessAdminPanel, canAccessPartnerArea, normalizeUserRole } from '@services/auth';
import { useRecaptchaV3 } from '@services/system/useRecaptchaV3';
import { hasInvalidGoogleClientIdCandidate, normalizeGoogleClientId } from '@/config/googleAuth';
import { useTheme } from '@providers/ThemeProvider';
import PublicBrandLink from '../../../components/shared/layout/PublicBrandLink';

type AuthMode = 'login' | 'signup' | 'forgot' | 'forgot-success' | 'two-factor';

type GoogleCredentialResponse = {
  credential?: string;
  select_by?: string;
};

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (options: {
            client_id: string;
            callback: (response: GoogleCredentialResponse) => void;
            context?: 'signin' | 'signup' | 'use';
            ux_mode?: 'popup' | 'redirect';
            auto_select?: boolean;
          }) => void;
          renderButton: (element: HTMLElement, options: {
            theme?: 'outline' | 'filled_blue' | 'filled_black';
            size?: 'large' | 'medium' | 'small';
            type?: 'standard' | 'icon';
            shape?: 'rectangular' | 'pill' | 'circle' | 'square';
            text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
            logo_alignment?: 'left' | 'center';
            width?: number;
          }) => void;
          cancel?: () => void;
        };
      };
    };
  }
}

interface AuthProps {
  onLogin: (user: UserProfile | null, token?: string | null) => Promise<void>;
}

type AuthApiUser = Record<string, unknown> & {
  id?: string;
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
  billing?: Record<string, unknown>;
  plan?: string;
  billing_cycle?: string;
  photoUrl?: string;
  photo_url?: string;
  status?: string;
  emailVerified?: boolean;
  email_verified?: boolean;
  level?: number | string;
  xp?: number | string;
  commentsCount?: number | string;
  comments_count?: number | string;
  targetExam?: string;
  target_exam?: string;
  savedQuestionIds?: string[];
  simulations?: UserProfile['simulations'];
  purchasedMaterialIds?: string[];
  preferences?: UserProfile['preferences'] | string;
  reputation?: number | string;
};

type GoogleAuthResponse = {
  success?: boolean;
  message?: string;
  data?: {
    require2FA?: boolean;
    email?: string;
    user?: AuthApiUser;
    token?: string | null;
    isNewUser?: boolean;
  };
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const decodeGoogleCredentialProfile = (credential: string): { name: string; email: string } => {
  try {
    const payload = credential.split('.')[1] || '';
    if (!payload) {
      return { name: '', email: '' };
    }

    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = typeof window !== 'undefined'
      ? window.atob(base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '='))
      : '';
    const parsed = JSON.parse(decoded || '{}') as { name?: string; email?: string };

    return {
      name: String(parsed.name || '').trim(),
      email: String(parsed.email || '').trim(),
    };
  } catch {
    return { name: '', email: '' };
  }
};

const resolveOptionalString = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized ? normalized : undefined;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return undefined;
};

const resolveBillingPlan = (value: unknown): UserProfile['billing']['plan'] => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'elite') return 'Elite';
  if (normalized === 'pro') return 'Pro';
  if (normalized === 'essencial') return 'Essencial';
  return 'Gratuito';
};

const resolveBillingCycle = (value: unknown): UserProfile['billing']['billingCycle'] => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'annual') return 'annual';
  if (normalized === 'quarterly') return 'quarterly';
  return 'monthly';
};

const resolveUserStatus = (value: unknown): UserProfile['status'] => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'suspended') return 'suspended';
  if (normalized === 'banned') return 'banned';
  if (normalized === 'pending') return 'pending';
  return 'active';
};

const featureItems = [
  { label: 'Milhares de questões', icon: CircleHelp },
  { label: 'Desempenho com IA', icon: TrendingUp },
  { label: 'Raio-X da Banca', icon: Search },
  { label: 'Simulados e rankings', icon: Clock3 },
  { label: 'Conteúdo atualizado', icon: Bookmark },
];

const buildUserProfile = (rawUser: UserProfile | AuthApiUser): UserProfile => {
  const user = rawUser as AuthApiUser;
  const resolvedBilling = user.billing && typeof user.billing === 'object' ? user.billing : {};
  const role = normalizeUserRole(user.role);
  const baseProfile = {
    ...user,
    role,
    isAdmin: role === 'admin',
    isStaff: role === 'staff',
  } as UserProfile;

  return {
    ...baseProfile,
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: Boolean(user.emailVerified ?? user.email_verified ?? false),
    phone: resolveOptionalString(user.phone),
    level: Number(user.level || 1),
    xp: Number(user.xp || 0),
    commentsCount: Number(user.commentsCount || user.comments_count || 0),
    targetExam: user.targetExam || user.target_exam || '',
    savedQuestionIds: user.savedQuestionIds || [],
    simulations: user.simulations || [],
    purchasedMaterialIds: user.purchasedMaterialIds || [],
    preferences: user.preferences
      ? (typeof user.preferences === 'string' ? JSON.parse(user.preferences) : user.preferences)
      : { shareData: true, notifications: true },
    billing: {
      plan: resolveBillingPlan(resolvedBilling.plan || user.plan),
      billingCycle: resolveBillingCycle(resolvedBilling.billingCycle || user.billing_cycle),
      nextBilling: resolveOptionalString(resolvedBilling.nextBilling),
      cardLast4: resolveOptionalString(resolvedBilling.cardLast4),
      paymentDay: Number(resolvedBilling.paymentDay || 0) || undefined,
    },
    photoUrl: user.photoUrl || user.photo_url || undefined,
    reputation: Number(user.reputation || 100),
    status: resolveUserStatus(user.status),
    isPartner: canAccessPartnerArea(baseProfile),
    canAccessAdmin: canAccessAdminPanel(baseProfile),
  };
};

const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const systemSettings = useAppConfigStore((state) => state.systemSettings);
  const { theme } = useTheme();

  const registrationEnabled = systemSettings?.features?.registrationEnabled !== false;
  const rawGoogleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || systemSettings?.googleAuthClientId || '';
  const googleClientId = normalizeGoogleClientId(rawGoogleClientId);
  const hasInvalidGoogleClientId = hasInvalidGoogleClientIdCandidate(rawGoogleClientId);
  const recaptchaEnabled = !!systemSettings?.recaptchaEnabled && !!systemSettings?.recaptchaSiteKey;

  const [searchQueryString, setSearchQueryString] = useState('');
  const searchParams = React.useMemo(
    () => new URLSearchParams(searchQueryString),
    [searchQueryString],
  );
  const [mode, setMode] = useState<AuthMode>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [googleScriptReady, setGoogleScriptReady] = useState(false);
  const [googleScriptFailed, setGoogleScriptFailed] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [twoFactorEmail, setTwoFactorEmail] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [pendingGoogleCredential, setPendingGoogleCredential] = useState<string | null>(null);
  const [googleProfileData, setGoogleProfileData] = useState({ name: '', phone: '', email: '' });
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
    termsAccepted: false,
    forgotEmail: '',
  });

  const googleButtonRef = useRef<HTMLDivElement>(null);
  const analyticsSessionKeyRef = useRef('');
  const trackedAuthVisitRef = useRef(false);
  const trackedSignupStartRef = useRef(false);
  const trackedSignupEmailsRef = useRef<Set<string>>(new Set());

  const isSignup = mode === 'signup';
  const isForgot = mode === 'forgot';
  const isAuthForm = mode === 'login' || mode === 'signup' || mode === 'forgot';
  const {
    executeRecaptcha,
    isReady: isRecaptchaReady,
    loadError: recaptchaLoadError,
  } = useRecaptchaV3({
    enabled: recaptchaEnabled && isAuthForm,
    siteKey: systemSettings?.recaptchaSiteKey,
  });

  const getAnalyticsSessionKey = () => {
    if (!analyticsSessionKeyRef.current) {
      analyticsSessionKeyRef.current = analyticsTrackingService.getSessionKey();
    }

    return analyticsSessionKeyRef.current;
  };

  const update = (field: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError('');
  };

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setError('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setPendingGoogleCredential(null);
    setGoogleProfileData({ name: '', phone: '', email: '' });
  };

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const syncSearchQueryString = () => {
      setSearchQueryString(window.location.search || '');
    };

    syncSearchQueryString();
    window.addEventListener('popstate', syncSearchQueryString);

    return () => {
      window.removeEventListener('popstate', syncSearchQueryString);
    };
  }, []);

  useEffect(() => {
    const nextMode = searchParams.get('mode');
    if (nextMode !== 'signup' && nextMode !== 'login') {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      setMode(nextMode);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [searchParams]);

  useEffect(() => {
    if (trackedAuthVisitRef.current) return;

    trackedAuthVisitRef.current = true;
    void analyticsTrackingService.trackLifecycleEvent({
      eventName: 'identifiable_visit',
      source: 'auth',
      sessionKey: getAnalyticsSessionKey(),
      email: formData.email.trim() || null,
      metadata: { mode },
    });
  }, [formData.email, mode]);

  useEffect(() => {
    if (mode !== 'signup' || trackedSignupStartRef.current) return;

    trackedSignupStartRef.current = true;
    void analyticsTrackingService.trackLifecycleEvent({
      eventName: 'signup_started',
      source: 'auth',
      sessionKey: getAnalyticsSessionKey(),
      email: formData.email.trim() || null,
    });
  }, [formData.email, mode]);

  useEffect(() => {
    if (mode !== 'signup') return;

    const normalizedEmail = formData.email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(normalizedEmail) || trackedSignupEmailsRef.current.has(normalizedEmail)) {
      return;
    }

    trackedSignupEmailsRef.current.add(normalizedEmail);
    void analyticsTrackingService.trackLifecycleEvent({
      eventName: 'email_captured',
      source: 'auth',
      sessionKey: getAnalyticsSessionKey(),
      email: normalizedEmail,
      metadata: { mode },
    });
  }, [formData.email, mode]);

  const requestRecaptchaToken = React.useCallback(async (action: string) => {
    if (!recaptchaEnabled) {
      return null;
    }

    if (!isRecaptchaReady) {
      throw new Error(recaptchaLoadError || 'A verificacao de seguranca ainda esta carregando.');
    }

    return executeRecaptcha(action);
  }, [executeRecaptcha, isRecaptchaReady, recaptchaEnabled, recaptchaLoadError]);

  const handleLogin = async () => {
    if (!formData.email || !formData.password) {
      setError('Preencha e-mail e senha.');
      return;
    }

    setIsLoading(true);
    try {
      const captchaToken = await requestRecaptchaToken('auth_login');

      const result = await authFlowService.login({
        email: formData.email.trim(),
        password: formData.password,
        captchaToken,
      });

      if (result.data.require2FA) {
        setTwoFactorEmail(result.data.email || formData.email.trim());
        setMode('two-factor');
        return;
      }

      const { user, token } = result.data;
      try {
        await onLogin(buildUserProfile(user), token);
      } catch (sessionError) {
        setError(readApiErrorMessage(sessionError, 'Login realizado, mas não foi possível concluir sua sessão.'));
      }
    } catch (err: unknown) {
      setError(readApiErrorMessage(err, 'Não foi possível realizar o login agora.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!formData.name.trim()) { setError('Informe seu nome.'); return; }
    const normalizedPhone = formData.phone.replace(/\D/g, '');
    if (!normalizedPhone) { setError('Informe seu telefone com DDD.'); return; }
    if (![10, 11].includes(normalizedPhone.length)) { setError('Telefone inválido. Use DDD + número com 10 ou 11 dígitos.'); return; }
    if (!formData.email.trim()) { setError('Informe seu e-mail.'); return; }
    if (formData.password.length < 6) { setError('A senha deve ter pelo menos 6 caracteres.'); return; }
    if (formData.password !== formData.confirmPassword) { setError('As senhas não coincidem.'); return; }
    if (!formData.termsAccepted) { setError('Aceite os termos de uso para continuar.'); return; }

    setIsLoading(true);
    try {
      const captchaToken = await requestRecaptchaToken('auth_register');

      const referralCode = searchParams.get('ref') || searchParams.get('referral');
      const result = await authFlowService.register({
        name: formData.name.trim(),
        phone: normalizedPhone,
        email: formData.email.trim(),
        password: formData.password,
        captchaToken,
        referralCode,
      });

      const { user, token } = result.data;
      void analyticsTrackingService.trackLifecycleEvent({
        eventName: 'signup_completed',
        source: 'auth',
        sessionKey: getAnalyticsSessionKey(),
        userId: user?.id ? String(user.id) : null,
        email: user?.email || formData.email.trim(),
        metadata: { mode: 'signup' },
      });
      try {
        await onLogin(buildUserProfile(user), token);
      } catch (sessionError) {
        setError(readApiErrorMessage(sessionError, 'Cadastro realizado, mas não foi possível concluir sua sessão.'));
      }
    } catch (err: unknown) {
      setError(readApiErrorMessage(err, 'Não foi possível criar sua conta agora.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!formData.forgotEmail.trim()) {
      setError('Informe seu e-mail.');
      return;
    }

    setIsLoading(true);
    try {
      const captchaToken = await requestRecaptchaToken('auth_forgot_password');

      const message = await authFlowService.forgotPassword({
        email: formData.forgotEmail.trim(),
        captchaToken,
      });

      if (message) {
        setMode('forgot-success');
      }
    } catch (err: unknown) {
      setError(readApiErrorMessage(err, 'Não foi possível processar sua solicitação.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify2FA = async () => {
    if (twoFactorCode.length < 6) {
      setError('Informe o código de 6 dígitos.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await authFlowService.verifyTwoFactor({
        email: twoFactorEmail,
        code: twoFactorCode,
      });

      try {
        await onLogin(null, result.token);
      } catch (sessionError) {
        setError(readApiErrorMessage(sessionError, 'Código validado, mas não foi possível concluir sua sessão.'));
      }
    } catch (err: unknown) {
      setError(readApiErrorMessage(err, 'Não foi possível validar o código de segurança.'));
    } finally {
      setIsLoading(false);
    }
  };

  const finalizeGoogleAuth = React.useCallback(async (result: GoogleAuthResponse, source: 'google_auth' | 'google_auth_profile') => {
    if (!(result.success && result.data)) {
      throw new Error(result.message || 'Nao foi possivel entrar com Google.');
    }

    if (result.data.require2FA) {
      setTwoFactorEmail(result.data.email || '');
      setMode('two-factor');
      return;
    }

    const { user, token, isNewUser } = result.data;
    if (isNewUser) {
      void analyticsTrackingService.trackLifecycleEvent({
        eventName: 'signup_completed',
        source,
        sessionKey: getAnalyticsSessionKey(),
        userId: user?.id ? String(user.id) : null,
        email: user?.email || null,
        metadata: { mode: 'google' },
      });
    }

    await onLogin(buildUserProfile(user), token);
  }, [onLogin]);

  const handleGoogleCredential = React.useCallback(async (response: GoogleCredentialResponse) => {
    const credential = response.credential || '';
    if (!credential) {
      setError('Não foi possível ler a resposta do Google.');
      return;
    }

    setIsGoogleLoading(true);
    setError('');

    try {
      const referralCode = searchParams.get('ref') || searchParams.get('referral');
      const loginResult: GoogleAuthResponse = await apiClient.post(ENDPOINTS.auth.google, {
        credential,
        referralCode,
        createIfMissing: false,
      });

      await finalizeGoogleAuth(loginResult, 'google_auth');
    } catch (err: unknown) {
      const message = readApiErrorMessage(err, 'Nao foi possivel entrar com Google.');
      const shouldCollectProfile = /conta nao encontrada|crie sua conta antes de entrar com google/i.test(message);

      if (shouldCollectProfile && registrationEnabled) {
        const decodedProfile = decodeGoogleCredentialProfile(credential);
        setPendingGoogleCredential(credential);
        setGoogleProfileData({
          name: decodedProfile.name || formData.name || '',
          email: decodedProfile.email || formData.email || '',
          phone: '',
        });
        setMode('signup');
        setError('Complete nome e telefone para concluir o cadastro com Google.');
        return;
      }

      setError(message);
    } finally {
      setIsGoogleLoading(false);
    }
  }, [finalizeGoogleAuth, formData.email, formData.name, registrationEnabled, searchParams]);

  const handleGoogleProfileSignup = React.useCallback(async () => {
    const credential = pendingGoogleCredential;
    if (!credential) {
      setError('Nao foi possivel continuar o cadastro com Google. Tente novamente.');
      return;
    }

    const normalizedName = googleProfileData.name.trim();
    const normalizedPhone = googleProfileData.phone.replace(/\D/g, '');
    if (!normalizedName) {
      setError('Informe seu nome completo para concluir o cadastro.');
      return;
    }

    if (!normalizedPhone || ![10, 11].includes(normalizedPhone.length)) {
      setError('Informe telefone com DDD (10 ou 11 digitos).');
      return;
    }

    setIsGoogleLoading(true);
    setError('');

    try {
      const referralCode = searchParams.get('ref') || searchParams.get('referral');
      const result: GoogleAuthResponse = await apiClient.post(ENDPOINTS.auth.google, {
        credential,
        referralCode,
        createIfMissing: true,
        profile: {
          name: normalizedName,
          phone: normalizedPhone,
        },
      });

      await finalizeGoogleAuth(result, 'google_auth_profile');
      setPendingGoogleCredential(null);
      setGoogleProfileData({ name: '', phone: '', email: '' });
    } catch (err: unknown) {
      setError(readApiErrorMessage(err, 'Nao foi possivel concluir o cadastro com Google.'));
    } finally {
      setIsGoogleLoading(false);
    }
  }, [finalizeGoogleAuth, googleProfileData, pendingGoogleCredential, searchParams]);

  useEffect(() => {
    if (!googleClientId || !googleScriptReady || !isAuthForm || isForgot) {
      return;
    }

    const googleIdentity = window.google?.accounts?.id;
    const buttonContainer = googleButtonRef.current;
    if (!googleIdentity || !buttonContainer) {
      return;
    }

    buttonContainer.innerHTML = '';
    googleIdentity.initialize({
      client_id: googleClientId,
      callback: handleGoogleCredential,
      context: isSignup ? 'signup' : 'signin',
      ux_mode: 'popup',
      auto_select: false,
    });
    googleIdentity.renderButton(buttonContainer, {
      theme: theme === 'dark' ? 'filled_black' : 'outline',
      size: 'large',
      type: 'standard',
      shape: 'rectangular',
      text: isSignup ? 'signup_with' : 'signin_with',
      logo_alignment: 'left',
      width: Math.min(buttonContainer.clientWidth || 360, 400),
    });

    return () => {
      buttonContainer.innerHTML = '';
      googleIdentity.cancel?.();
    };
  }, [googleClientId, googleScriptReady, handleGoogleCredential, isAuthForm, isForgot, isSignup, theme]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'login') void handleLogin();
    else if (mode === 'signup') void handleRegister();
    else if (mode === 'forgot') void handleForgotPassword();
    else if (mode === 'two-factor') void handleVerify2FA();
  };

  const title = isForgot ? 'Recuperar senha' : isSignup ? 'Criar sua conta' : 'Bem-vindo de volta!';
  const subtitle = isForgot
    ? 'Informe seu e-mail para receber as instruções.'
    : isSignup
      ? 'Comece gratuitamente e organize seus estudos.'
      : 'Faça login para continuar seus estudos.';
  const primaryLabel = isForgot ? 'Enviar instruções' : isSignup ? 'Criar conta grátis' : 'Entrar na plataforma';

  const renderMessage = () => error ? (
    <div className="space-y-3">
      <div className="flex items-center gap-2.5 rounded-xl border border-red-100 bg-red-50 p-3 text-xs font-bold text-red-600 dark:border-red-900/30 dark:bg-red-900/20 dark:text-red-300">
        <AlertCircle size={14} className="shrink-0" />
        <span className="flex-1">{error}</span>
      </div>
      {(error.includes('não cadastrado') || error.includes('nao cadastrado')) && (
        <button
          type="button"
          onClick={() => {
            if (isForgot) setFormData((prev) => ({ ...prev, email: formData.forgotEmail }));
            switchMode('signup');
          }}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50 py-2.5 text-[10px] font-black uppercase tracking-widest text-indigo-600 transition-all hover:bg-indigo-100 dark:border-indigo-900/30 dark:bg-indigo-900/20 dark:text-indigo-300"
        >
          <UserPlus size={14} /> Criar uma conta agora
        </button>
      )}
    </div>
  ) : null;

  const renderGoogleButton = () => {
    if (isForgot) return null;

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 text-xs font-semibold text-slate-500">
          <span className="h-px bg-slate-200 dark:bg-slate-800" />
          ou
          <span className="h-px bg-slate-200 dark:bg-slate-800" />
        </div>
        <div className="relative min-h-[44px]">
          {googleClientId && !googleScriptFailed ? (
            <>
              {(isGoogleLoading || !googleScriptReady) && (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl border border-slate-200 bg-white/80 backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/80">
                  <Loader2 size={18} className="animate-spin text-indigo-600" />
                </div>
              )}
              <div ref={googleButtonRef} className="flex min-h-[44px] w-full justify-center" />
            </>
          ) : (
            <button
              type="button"
              disabled
              className="flex h-12 w-full items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-400 dark:border-slate-700 dark:bg-slate-900"
              title={hasInvalidGoogleClientId ? 'Client ID do Google invalido.' : googleScriptFailed ? 'Nao foi possivel carregar o script do Google.' : 'Google OAuth ainda nao configurado.'}
            >
              Entrar com Google indisponível
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderAuthLayout = (children: React.ReactNode, narrow = false) => (
    <div className="min-h-[100dvh] bg-[#f5f7ff] text-slate-950 dark:bg-slate-950 dark:text-slate-100 lg:grid lg:grid-cols-[47%_53%]">
      {googleClientId && (
        <Script
          src="https://accounts.google.com/gsi/client"
          strategy="afterInteractive"
          onLoad={() => {
            setGoogleScriptFailed(false);
            setGoogleScriptReady(true);
          }}
          onError={() => {
            setGoogleScriptReady(false);
            setGoogleScriptFailed(true);
          }}
        />
      )}
      <aside className="relative hidden min-h-[100dvh] overflow-hidden bg-[radial-gradient(circle_at_70%_20%,rgba(116,92,255,0.42),transparent_34%),linear-gradient(145deg,#0c0e43_0%,#12105f_48%,#19106f_100%)] px-10 py-9 text-white lg:flex lg:flex-col xl:px-16">
        <div className="pointer-events-none absolute -right-44 top-6 h-[760px] w-[760px] rounded-full border border-white/5" />
        <div className="pointer-events-none absolute -right-28 top-28 h-[620px] w-[620px] rounded-full border border-white/5" />
        <div className="pointer-events-none absolute -bottom-36 left-16 h-[520px] w-[520px] rounded-full border border-violet-300/5" />

        <div className="relative z-10 flex min-h-full flex-col">
          <PublicBrandLink width={238} surface="dark" priority className="inline-flex" />

          <div className="mt-14 max-w-lg xl:mt-16">
            <h1 className="text-4xl font-black leading-[1.08] tracking-tight xl:text-[2.7rem]">
              Prepare-se para ser <span className="text-violet-400">aprovado.</span>
            </h1>
            <p className="mt-4 max-w-md text-sm font-medium leading-6 text-indigo-100/90">
              Questões comentadas, Raio-X de bancas e simulados para acelerar seus estudos.
            </p>

            <div className="mt-7 space-y-2.5">
              {featureItems.map(({ label, icon: Icon }) => (
                <div key={label} className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white ring-1 ring-white/10">
                    <Icon size={16} />
                  </span>
                  <span className="text-sm font-semibold text-white">{label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-auto max-w-sm pt-10">
            <div className="mb-4 h-1 w-8 rounded-full bg-violet-400" />
            <div className="flex items-start gap-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-indigo-200/25 bg-white/5 text-indigo-100">
                <ShieldCheck size={18} />
              </span>
              <p className="text-xs leading-5 text-indigo-100/85">
                <strong className="block text-white">Mais de 25 mil alunos</strong>
                estudando todos os dias.
              </p>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex min-h-[100dvh] items-center justify-center px-4 py-10 sm:px-8 lg:px-12">
        <div className={`w-full ${narrow ? 'max-w-md' : 'max-w-[460px]'}`}>
          <div className="mb-8 flex justify-center lg:hidden">
            <PublicBrandLink width={230} priority />
          </div>
          {children}
        </div>
      </main>
    </div>
  );

  if (mode === 'forgot-success') {
    return renderAuthLayout(
      <>
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-200/70 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
            <CheckCircle2 size={34} />
          </div>
          <h2 className="mt-6 text-2xl font-black">E-mail enviado!</h2>
          <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
            Se o endereço <strong className="text-slate-700 dark:text-slate-200">{formData.forgotEmail}</strong> estiver cadastrado, você receberá as instruções em breve.
          </p>
          <button
            onClick={() => switchMode('login')}
            className="mt-7 h-12 w-full rounded-xl bg-[#4b28ff] text-sm font-bold text-white transition hover:bg-[#3d20d6]"
          >
            Voltar para o login
          </button>
        </div>
      </>,
      true,
    );
  }

  if (mode === 'two-factor') {
    return renderAuthLayout(
      <>
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/70 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
          <div className="mb-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
              <ShieldCheck size={32} />
            </div>
            <h2 className="mt-5 text-2xl font-black">Verificação em duas etapas</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
              Insira o código de 6 dígitos para <strong>{twoFactorEmail}</strong>.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <input
              type="text"
              maxLength={6}
              autoFocus
              value={twoFactorCode}
              onChange={(event) => {
                setTwoFactorCode(event.target.value.replace(/\D/g, ''));
                setError('');
              }}
              className="h-14 w-full rounded-xl border border-slate-200 bg-slate-50 text-center text-2xl font-black tracking-[0.28em] outline-none transition focus:border-[#4b28ff] focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800"
              placeholder="000000"
            />
            {renderMessage()}
            <button
              type="submit"
              disabled={isLoading}
              className="flex h-14 w-full items-center justify-center gap-3 rounded-xl bg-[#4b28ff] text-sm font-bold text-white transition hover:bg-[#3d20d6] disabled:opacity-60"
            >
              {isLoading ? <Loader2 size={18} className="animate-spin" /> : <><CheckCircle2 size={16} /> Verificar e entrar</>}
            </button>
            <button
              type="button"
              onClick={() => switchMode('login')}
              className="w-full text-xs font-bold uppercase tracking-widest text-slate-400 transition hover:text-[#4b28ff]"
            >
              Voltar ao login
            </button>
          </form>
        </div>
      </>,
      true,
    );
  }

  return renderAuthLayout(
    <>
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/70 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 dark:shadow-none sm:p-8">
        <div className="mb-7 text-center">
          {isForgot && (
            <button
              onClick={() => switchMode('login')}
              className="mb-5 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400 transition hover:text-[#4b28ff]"
            >
              <ArrowLeft size={14} /> Voltar
            </button>
          )}
          <h2 className="text-2xl font-black tracking-tight text-[#090b2f] dark:text-white">{title}</h2>
          <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">{subtitle}</p>
        </div>

        {isSignup && !registrationEnabled ? (
          <div className="rounded-2xl border border-amber-100 bg-amber-50 p-7 text-center dark:border-amber-500/20 dark:bg-amber-500/10">
            <AlertCircle size={30} className="mx-auto text-amber-600 dark:text-amber-300" />
            <h3 className="mt-4 text-base font-black">Cadastros suspensos</h3>
            <p className="mt-2 text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">
              No momento não estamos aceitando novos alunos.
            </p>
            <button onClick={() => switchMode('login')} className="mt-5 text-xs font-black uppercase tracking-widest text-[#4b28ff]">
              Voltar para login
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignup && (
              <div className="space-y-2">
                <label className="ml-0.5 text-xs font-black uppercase tracking-widest text-slate-500">Nome completo</label>
                <div className="relative">
                  <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    required
                    autoFocus
                    value={formData.name}
                    onChange={(event) => update('name', event.target.value)}
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm font-medium outline-none transition focus:border-[#4b28ff] focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900 dark:focus:ring-indigo-950"
                    placeholder="Seu nome completo"
                  />
                </div>
              </div>
            )}

            {isSignup && (
              <div className="space-y-2">
                <label className="ml-0.5 text-xs font-black uppercase tracking-widest text-slate-500">Telefone / WhatsApp</label>
                <div className="relative">
                  <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="tel"
                    required
                    inputMode="tel"
                    autoComplete="tel"
                    value={formData.phone}
                    onChange={(event) => update('phone', event.target.value)}
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm font-medium outline-none transition focus:border-[#4b28ff] focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900 dark:focus:ring-indigo-950"
                    placeholder="(11) 99999-9999"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="ml-0.5 text-xs font-black uppercase tracking-widest text-slate-500">
                {isForgot ? 'E-mail cadastrado' : 'E-mail'}
              </label>
              <div className="relative">
                <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  required
                  autoFocus={!isSignup}
                  value={isForgot ? formData.forgotEmail : formData.email}
                  onChange={(event) => update(isForgot ? 'forgotEmail' : 'email', event.target.value)}
                  className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm font-medium outline-none transition focus:border-[#4b28ff] focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900 dark:focus:ring-indigo-950"
                  placeholder="exemplo@email.com"
                />
              </div>
            </div>

            {!isForgot && (
              <div className="space-y-2">
                <label className="ml-0.5 text-xs font-black uppercase tracking-widest text-slate-500">Senha</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={formData.password}
                    onChange={(event) => update('password', event.target.value)}
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-12 text-sm font-medium outline-none transition focus:border-[#4b28ff] focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900 dark:focus:ring-indigo-950"
                    placeholder={isSignup ? 'Mínimo 6 caracteres' : '••••••••'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-[#4b28ff]"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            )}

            {isSignup && (
              <div className="space-y-2">
                <label className="ml-0.5 text-xs font-black uppercase tracking-widest text-slate-500">Confirmar senha</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={formData.confirmPassword}
                    onChange={(event) => update('confirmPassword', event.target.value)}
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-12 text-sm font-medium outline-none transition focus:border-[#4b28ff] focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900 dark:focus:ring-indigo-950"
                    placeholder="Repita a senha"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((current) => !current)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-[#4b28ff]"
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            )}

            {isSignup && (
              <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-slate-50 p-3.5 transition hover:bg-indigo-50 dark:bg-slate-800/60 dark:hover:bg-slate-800">
                <input
                  type="checkbox"
                  checked={formData.termsAccepted}
                  onChange={(event) => update('termsAccepted', event.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded accent-[#4b28ff]"
                />
                <span className="text-[11px] font-medium leading-relaxed text-slate-600 dark:text-slate-400">
                  Li e aceito os <Link href="/terms" className="font-bold text-[#4b28ff] hover:underline">Termos de Uso</Link> e a <Link href="/privacy" className="font-bold text-[#4b28ff] hover:underline">Política de Privacidade</Link>.
                </span>
              </label>
            )}

            {!isSignup && !isForgot && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => switchMode('forgot')}
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#4b28ff] transition hover:text-[#351cc2]"
                >
                  Esqueci minha senha
                </button>
              </div>
            )}

            {renderMessage()}

            <button
              type="submit"
              disabled={isLoading}
              className="flex h-12 w-full items-center justify-center gap-3 rounded-xl bg-[#4b28ff] text-sm font-bold text-white shadow-lg shadow-indigo-200 transition hover:bg-[#3d20d6] active:scale-[0.99] disabled:opacity-60 dark:shadow-none"
            >
              {isLoading ? <Loader2 size={20} className="animate-spin" /> : (
                <>
                  {isForgot ? <Mail size={17} /> : <ArrowRight size={17} />}
                  {primaryLabel}
                </>
              )}
            </button>

            {renderGoogleButton()}

            {pendingGoogleCredential && (
              <div className="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/70 p-4 dark:border-indigo-900/40 dark:bg-indigo-950/20">
                <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                  Conta Google encontrada sem cadastro local. Complete os dados para criar a conta.
                </p>
                {googleProfileData.email ? (
                  <p className="text-[11px] text-indigo-700/80 dark:text-indigo-300/80">
                    E-mail Google: <strong>{googleProfileData.email}</strong>
                  </p>
                ) : null}

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Nome completo</label>
                  <input
                    type="text"
                    value={googleProfileData.name}
                    onChange={(event) => {
                      setGoogleProfileData((current) => ({ ...current, name: event.target.value }));
                      setError('');
                    }}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium outline-none transition focus:border-[#4b28ff] focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900 dark:focus:ring-indigo-950"
                    placeholder="Seu nome completo"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Telefone / WhatsApp</label>
                  <input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={googleProfileData.phone}
                    onChange={(event) => {
                      setGoogleProfileData((current) => ({ ...current, phone: event.target.value }));
                      setError('');
                    }}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium outline-none transition focus:border-[#4b28ff] focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900 dark:focus:ring-indigo-950"
                    placeholder="(11) 99999-9999"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => void handleGoogleProfileSignup()}
                  disabled={isGoogleLoading}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#4b28ff] text-sm font-bold text-white transition hover:bg-[#3d20d6] disabled:opacity-60"
                >
                  {isGoogleLoading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                  Concluir cadastro com Google
                </button>
              </div>
            )}
          </form>
        )}

        {!isForgot && (
          <div className="mt-7 text-center">
            <p className="text-xs font-medium text-slate-500">
              {isSignup ? 'Já tem uma conta?' : 'Ainda não tem uma conta?'}
              {' '}
              <button
                onClick={() => switchMode(isSignup ? 'login' : 'signup')}
                className="font-bold text-[#4b28ff] transition hover:text-[#351cc2]"
              >
                {isSignup ? 'Fazer login' : 'Criar conta'}
              </button>
            </p>
          </div>
        )}
      </div>

      <Link
        href="/"
        className="mx-auto mt-7 flex w-fit items-center gap-2 text-xs font-bold text-[#4b28ff] transition hover:text-[#351cc2]"
      >
        <ArrowLeft size={16} /> Voltar para a home
      </Link>
    </>,
  );
};

export default Auth;
