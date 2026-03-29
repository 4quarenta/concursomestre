import React, { useState, useEffect, useRef } from 'react';
import {
  Mail, Lock, User, Eye, EyeOff, Loader2, BrainCircuit, X, MessageSquare, Shield, CheckCircle2, ChevronRight, Github, Chrome, ArrowRight, ShieldCheck, AlertCircle, ArrowLeft, KeyRound, Terminal, UserPlus
} from 'lucide-react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import ReCAPTCHA from 'react-google-recaptcha';
import { UserProfile } from '../types';
import { useData } from '../context/DataContext';
import { apiClient, ENDPOINTS } from '../src/core/api';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import { setStoredSession, setStoredToken } from '@core/auth/session';

/** Modo de visualização da tela de autenticação */
type AuthMode = 'login' | 'signup' | 'forgot' | 'forgot-success' | 'two-factor';

interface AuthProps {
  onLogin: (user: UserProfile) => void;
}

/** Monta UserProfile com valores padrão a partir do objeto retornado pela API */
const buildUserProfile = (user: any): UserProfile => {
  const resolvedBilling = user.billing && typeof user.billing === 'object' ? user.billing : {};

  return {
    ...user,
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    level: Number(user.level || 1),
    xp: Number(user.xp || 0),
    savedQuestionIds: user.savedQuestionIds || [],
    simulations: user.simulations || [],
    purchasedMaterialIds: user.purchasedMaterialIds || [],
    preferences: user.preferences
      ? (typeof user.preferences === 'string' ? JSON.parse(user.preferences) : user.preferences)
      : { shareData: true, notifications: true },
    billing: {
      plan: resolvedBilling.plan || user.plan || 'Gratuito',
      billingCycle: resolvedBilling.billingCycle || user.billing_cycle || 'monthly',
      nextBilling: resolvedBilling.nextBilling || undefined,
      cardLast4: resolvedBilling.cardLast4 || undefined,
      paymentDay: resolvedBilling.paymentDay || undefined,
    },
    reputation: Number(user.reputation || 100),
    status: user.status,
    isAdmin: user.role === 'admin',
    isPartner: user.role === 'partner' || user.role === 'admin',
  };
};

const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [searchParams] = useSearchParams();
  const { systemSettings } = useData();
  const { addToast } = useToast();
  const { theme } = useTheme();

  const registrationEnabled = systemSettings?.features?.registrationEnabled !== false;

  // Determina o modo inicial a partir do query param ?mode=signup ou ?mode=login
  const initialMode: AuthMode = searchParams.get('mode') === 'signup' ? 'signup' : 'login';
  const [mode, setMode] = useState<AuthMode>(initialMode);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const isDevMode = systemSettings?.appMode !== 'production';

  // Cambia para o modo correto se o query param mudar
  useEffect(() => {
    const m = searchParams.get('mode');
    if (m === 'signup') setMode('signup');
    else if (m === 'login') setMode('login');
  }, [searchParams]);

  // Preenche email/senha a partir do DevModeBanner via sessionStorage
  useEffect(() => {
    const prefillEmail = sessionStorage.getItem('dev_prefill_email');
    const prefillPass = sessionStorage.getItem('dev_prefill_password');
    if (prefillEmail && prefillPass) {
      setFormData(prev => ({ ...prev, email: prefillEmail, password: prefillPass }));
      sessionStorage.removeItem('dev_prefill_email');
      sessionStorage.removeItem('dev_prefill_password');
    }
  }, []);

  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const recaptchaRef = useRef<ReCAPTCHA>(null);

  const [twoFactorEmail, setTwoFactorEmail] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    termsAccepted: false,
    forgotEmail: '',
  });

  const update = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  // ----- LOGIN -----
  const handleLogin = async () => {
    if (!formData.email || !formData.password) {
      setError('Preencha e-mail e senha.');
      return;
    }
    setIsLoading(true);
    try {
      if (!captchaToken && !isDevMode) {
        addToast('Por favor, complete o desafio de segurança.', 'error');
        return;
      }

      const result: any = await apiClient.post(ENDPOINTS.auth.login, {
        email: formData.email,
        password: formData.password,
        captchaToken
      });
      if (result.success && result.data) {
        if (result.data.require2FA) {
          setTwoFactorEmail(result.data.email);
          setMode('two-factor');
          return;
        }
        const { user, token } = result.data;
        const builtUser = buildUserProfile(user);
        setStoredSession(token, builtUser);
        onLogin(builtUser);
      } else {
        setError(result.message || 'E-mail ou senha incorretos.');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Erro de conexão com o servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  // ----- CADASTRO -----
  const handleRegister = async () => {
    if (!formData.name.trim()) { setError('Informe seu nome.'); return; }
    if (!formData.email.trim()) { setError('Informe seu e-mail.'); return; }
    if (formData.password.length < 6) { setError('A senha deve ter pelo menos 6 caracteres.'); return; }
    if (formData.password !== formData.confirmPassword) { setError('As senhas não coincidem.'); return; }
    if (!formData.termsAccepted) { setError('Aceite os termos de uso para continuar.'); return; }

    setIsLoading(true);
    try {
      if (!captchaToken && !isDevMode) {
        addToast('Por favor, complete o desafio de segurança.', 'error');
        return;
      }

      const referralCode = searchParams.get('ref') || searchParams.get('referral');

      const result: any = await apiClient.post(ENDPOINTS.auth.register, {
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password,
        captchaToken,
        referralCode
      });
      if (result.success && result.data) {
        const { user, token } = result.data;
        const builtUser = buildUserProfile(user);
        setStoredSession(token, builtUser);
        // Auto-login imediato após o cadastro
        onLogin(builtUser);
      } else {
        setError(result.message || 'Erro ao criar conta.');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Erro de conexão com o servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  // ----- ESQUECI A SENHA -----
  const handleForgotPassword = async () => {
    if (!formData.forgotEmail.trim()) { setError('Informe seu e-mail.'); return; }
    setIsLoading(true);
    try {
      const res: any = await apiClient.post(ENDPOINTS.auth.forgotPassword, { email: formData.forgotEmail.trim() });
      if (res.success) {
        setMode('forgot-success');
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Erro ao processar solicitação.';
      setError(msg);
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
      const result: any = await apiClient.post('auth/verify_2fa.php', {
        email: twoFactorEmail,
        code: twoFactorCode
      });
      if (result.success && result.data) {
        const { token } = result.data;
        setStoredToken(token);
        
        // Fetch full profile since verify_2fa returns minimal data
        const profileRes: any = await apiClient.get('users/profile.php');
        if (profileRes.success && profileRes.data) {
           const userData = profileRes.data.user || profileRes.data;
           const builtUser = buildUserProfile(userData);
           setStoredSession(token, builtUser);
           onLogin(builtUser);
        }
      } else {
        setError(result.message || 'Código inválido.');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Erro na verificação do 2FA.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'login') handleLogin();
    else if (mode === 'signup') handleRegister();
    else if (mode === 'forgot') handleForgotPassword();
    else if (mode === 'two-factor') handleVerify2FA();
  };

  const switchMode = (m: AuthMode) => {
    setMode(m);
    setError('');
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  // ------- TELA DE SUCESSO DE RECUPERAÇÃO -------
  if (mode === 'forgot-success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-slate-950 dark:to-slate-900 p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl p-10 text-center space-y-5 border border-slate-100 dark:border-slate-800 animate-scale-in">
          <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 size={40} />
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">E-mail enviado!</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
            Se o endereço <strong className="text-slate-700 dark:text-slate-300">{formData.forgotEmail}</strong> estiver cadastrado,
            você receberá as instruções para redefinir sua senha em breve.
          </p>
          <button
            onClick={() => switchMode('login')}
            className="w-full py-4 bg-slate-900 dark:bg-indigo-600 text-white rounded-2xl font-bold text-xs tracking-widest uppercase hover:bg-indigo-600 dark:hover:bg-indigo-700 transition-all"
          >
            Voltar para o Login
          </button>
        </div>
      </div>
    );
  }

  // ------- TELA DE VERIFICAÇÃO 2FA -------
  if (mode === 'two-factor') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-slate-950 dark:to-slate-900 p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl p-10 border border-slate-100 dark:border-slate-800 animate-scale-in">
          <div className="text-center space-y-4 mb-8">
            <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mx-auto">
              <ShieldCheck size={32} />
            </div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">Verificação em Duas Etapas</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              Insira o código de 6 dígitos gerado pelo seu aplicativo de autenticação para <strong>{twoFactorEmail}</strong>.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <input
                type="text"
                maxLength={6}
                autoFocus
                value={twoFactorCode}
                onChange={e => {
                   setTwoFactorCode(e.target.value.replace(/\D/g, ''));
                   setError('');
                }}
                className="w-full text-center text-4xl font-black tracking-[0.3em] bg-slate-50 dark:bg-slate-800 border-none rounded-2xl py-5 outline-none focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-slate-200"
                placeholder="000000"
              />
              {error && (
                <p className="text-xs text-red-500 font-bold text-center animate-shake">{error}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 bg-slate-900 dark:bg-indigo-600 text-white rounded-2xl font-black text-xs tracking-widest uppercase hover:bg-slate-800 dark:hover:bg-indigo-700 transition-all shadow-xl flex items-center justify-center gap-3"
            >
              {isLoading ? <Loader2 size={18} className="animate-spin" /> : <><CheckCircle2 size={16} /> Verificar e Entrar</>}
            </button>

            <button
              type="button"
              onClick={() => setMode('login')}
              className="w-full text-[10px] font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest transition-colors"
            >
              Voltar ao Login
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ------- TELA PRINCIPAL -------
  const isSignup = mode === 'signup';
  const isForgot = mode === 'forgot';

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-slate-50 to-indigo-50/30 dark:from-slate-950 dark:to-slate-900 transition-colors">
      {/* Painel esquerdo decorativo (visível apenas em telas grandes) */}
      <div className="hidden lg:flex lg:w-5/12 bg-indigo-600 dark:bg-indigo-700 flex-col items-center justify-center p-16 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full -translate-x-40 -translate-y-40" />
          <div className="absolute bottom-0 right-0 w-80 h-80 bg-white rounded-full translate-x-32 translate-y-32" />
          <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-white rounded-full -translate-x-1/2 -translate-y-1/2 opacity-5" />
        </div>
        <div className="relative text-white space-y-8 max-w-xs">
          <div className="flex items-center gap-3">
            <BrainCircuit size={40} className="opacity-90" />
            <span className="text-2xl font-black tracking-tight">ConcursoMestre</span>
          </div>
          <h1 className="text-4xl font-black leading-tight">
            Prepare‑se para a <span className="text-indigo-200">aprovação</span>
          </h1>
          <p className="text-indigo-100 leading-relaxed text-sm font-medium">
            Questões comentadas, Raio‑X de bancas, simulados cronometrados e IA para acelerar seus estudos.
          </p>
          <div className="space-y-3">
            {[
              '✅ Banco com milhares de questões',
              '🧠 Análise de desempenho com IA',
              '📊 Raio‑X da Banca favorita',
              '🏆 Rankings e simulados',
            ].map(item => (
              <p key={item} className="text-indigo-100 text-sm font-semibold">{item}</p>
            ))}
          </div>
        </div>
      </div>

      {/* Formulário direito */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          {/* Logo mobile */}
          <div className="flex lg:hidden items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-xl mb-10 justify-center">
            <BrainCircuit size={28} />
            <span className="tracking-tight">ConcursoMestre</span>
          </div>

          {/* Card */}
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-xl border border-slate-200 dark:border-slate-800 p-8 sm:p-10 transition-colors animate-scale-in">

            {/* Cabeçalho */}
            <div className="mb-8">
              {isForgot && (
                <button
                  onClick={() => switchMode('login')}
                  className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors mb-5 uppercase tracking-widest"
                >
                  <ArrowLeft size={14} /> Voltar
                </button>
              )}
              <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                {isForgot ? 'Recuperar senha' : isSignup ? 'Criar conta grátis' : 'Bem‑vindo de volta'}
              </h2>
              <p className="text-slate-400 dark:text-slate-500 text-xs mt-1.5 font-medium">
                {isForgot
                  ? 'Informe seu e-mail e enviaremos as instruções.'
                  : isSignup
                    ? '100 XP de bônus ao se cadastrar!'
                    : 'Insira suas credenciais para continuar.'}
              </p>
            </div>

            {/* Bloco de cadastro suspenso */}
            {isSignup && !registrationEnabled ? (
              <div className="p-8 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20 rounded-3xl text-center space-y-4">
                <div className="w-14 h-14 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-500 rounded-2xl flex items-center justify-center mx-auto">
                  <AlertCircle size={28} />
                </div>
                <h3 className="text-base font-black text-slate-900 dark:text-slate-100">Cadastros Suspensos</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                  No momento não estamos aceitando novos alunos. Tente novamente mais tarde!
                </p>
                <button onClick={() => switchMode('login')} className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest hover:underline">
                  Voltar para Login
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">

                {/* Nome — apenas no cadastro */}
                {isSignup && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-0.5">Nome Completo</label>
                    <div className="relative">
                      <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        required
                        autoFocus
                        value={formData.name}
                        onChange={e => update('name', e.target.value)}
                        className="w-full h-12 pl-10 pr-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-slate-100 font-semibold text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600"
                        placeholder="Seu nome completo"
                      />
                    </div>
                  </div>
                )}

                {/* E-mail */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-0.5">
                    {isForgot ? 'E‑mail cadastrado' : 'E‑mail'}
                  </label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="email"
                      required
                      autoFocus={!isSignup}
                      value={isForgot ? formData.forgotEmail : formData.email}
                      onChange={e => update(isForgot ? 'forgotEmail' : 'email', e.target.value)}
                      className="w-full h-12 pl-10 pr-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-slate-100 font-semibold text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600"
                      placeholder="exemplo@email.com"
                    />
                  </div>
                </div>

                {/* Senha — não aparece em "esqueci" */}
                {!isForgot && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-0.5">Senha</label>
                    <div className="relative">
                      <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={formData.password}
                        onChange={e => update('password', e.target.value)}
                        className="w-full h-12 pl-10 pr-12 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-slate-100 font-semibold text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600"
                        placeholder={isSignup ? 'Mínimo 6 caracteres' : '••••••••'}
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                )}

                {/* Confirmar senha — apenas no cadastro */}
                {isSignup && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-0.5">Confirmar Senha</label>
                    <div className="relative">
                      <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        value={formData.confirmPassword}
                        onChange={e => update('confirmPassword', e.target.value)}
                        className="w-full h-12 pl-10 pr-12 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-slate-100 font-semibold text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600"
                        placeholder="Repita a senha"
                      />
                      <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                        {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                )}

                {/* Aceite dos termos — apenas no cadastro */}
                {isSignup && (
                  <label className="flex items-start gap-3 p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl cursor-pointer hover:bg-indigo-50/50 dark:hover:bg-slate-800 transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.termsAccepted}
                      onChange={e => update('termsAccepted', e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded accent-indigo-600 flex-shrink-0"
                    />
                    <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400 leading-relaxed">
                      Li e aceito os{' '}
                      <Link to="/terms" className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline">Termos de Uso</Link>
                      {' '}e a{' '}
                      <Link to="/privacy" className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline">Política de Privacidade</Link>.
                    </span>
                  </label>
                )}

                {/* Google reCAPTCHA — apenas no login e cadastro (desabilitado no DEV) */}
                {!isForgot && !isDevMode && (
                  <div className="flex justify-center py-2">
                    <ReCAPTCHA
                      ref={recaptchaRef}
                      sitekey={systemSettings.recaptchaSiteKey || "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI"}
                      onChange={(token) => setCaptchaToken(token)}
                      theme={theme === 'dark' ? 'dark' : 'light'}
                    />
                  </div>
                )}

                {/* Link Esqueci Senha — apenas no login */}
                {!isSignup && !isForgot && (
                  <div className="flex justify-end -mt-1">
                    <button
                      type="button"
                      onClick={() => switchMode('forgot')}
                      className="text-[11px] font-bold text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center gap-1"
                    >
                      <KeyRound size={12} /> Esqueci minha senha
                    </button>
                  </div>
                )}

                {/* Mensagem de erro */}
                {error && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2.5 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-xs font-bold border border-red-100 dark:border-red-900/30">
                      <AlertCircle size={14} className="flex-shrink-0" />
                      <span className="flex-1">{error}</span>
                    </div>
                    {error.includes('não cadastrado') && (
                      <button
                        type="button"
                        onClick={() => {
                          if (isForgot) setFormData(prev => ({ ...prev, email: formData.forgotEmail }));
                          switchMode('signup');
                        }}
                        className="w-full py-2.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl text-[10px] font-black uppercase tracking-widest border border-indigo-100 dark:border-indigo-900/30 hover:bg-indigo-100 transition-all flex items-center justify-center gap-2"
                      >
                        <UserPlus size={14} /> Criar uma Conta Agora
                      </button>
                    )}
                  </div>
                )}

                {/* Botão principal */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-13 py-3.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-black rounded-2xl text-xs uppercase tracking-[0.2em] transition-all shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30 disabled:opacity-50 flex items-center justify-center gap-3 mt-2"
                >
                  {isLoading
                    ? <Loader2 size={20} className="animate-spin" />
                    : isForgot
                      ? <><Mail size={16} /> Enviar instruções</>
                      : isSignup
                        ? <><ArrowRight size={16} /> Criar Conta Grátis</>
                        : <><ArrowRight size={16} /> Entrar na Plataforma</>
                  }
                </button>
              </form>
            )}

            {/* Troca de modo */}
            {!isForgot && (
              <div className="text-center space-y-3 mt-7">
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                  {isSignup ? 'Já tem conta?' : 'Novo por aqui?'}
                  {' '}
                  <button
                    onClick={() => switchMode(isSignup ? 'login' : 'signup')}
                    className="text-indigo-600 dark:text-indigo-400 font-black hover:underline uppercase tracking-widest"
                  >
                    {isSignup ? 'Fazer login' : 'Criar conta'}
                  </button>
                </p>

                <Link
                  to="/"
                  className="inline-block text-[10px] font-black text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 uppercase tracking-widest transition-colors"
                >
                  ← Voltar para a Home
                </Link>
              </div>
            )}

            {/* Painel de acesso rápido dev — apenas no modo login + dev */}
            {!isForgot && !isSignup && isDevMode && (
              <DevQuickLogin onLogin={onLogin} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Painel de login rápido para contas de desenvolvimento.
 * Visível apenas quando appMode !== 'production'.
 */
export const DevQuickLogin: React.FC<{ onLogin: (user: any) => void }> = ({ onLogin }) => {
  const { systemSettings } = useData();
  const [loading, setLoading] = useState<string | null>(null);

  if (systemSettings?.appMode === 'production') return null;

  const accounts = [
    { label: 'Aluno', email: 'aluno@email.com', color: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300' },
    { label: 'Admin', email: 'admin@concursomestre.com', color: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300' },
    { label: 'Parceiro', email: 'prof@concursomestre.com', color: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300' },
  ];

  const quickLogin = async (email: string) => {
    setLoading(email);
    try {
      const result: any = await apiClient.post(ENDPOINTS.auth.login, { email, password: '123456' });
      if (result.success && result.data) {
        const { user, token } = result.data;
        const builtUser = buildUserProfile(user);
        setStoredSession(token, builtUser);
        onLogin(builtUser);
      }
    } catch (e) {
      console.error('[DEV] Quick login failed:', e);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="mt-5 p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-2xl space-y-2">
      <p className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest flex items-center gap-1">
        <Terminal size={11} /> DEV — Acesso Rápido
      </p>
      <div className="flex flex-wrap gap-2">
        {accounts.map(acc => (
          <button
            key={acc.email}
            disabled={loading === acc.email}
            onClick={() => quickLogin(acc.email)}
            className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-xl text-xs font-bold transition-all hover:opacity-80 disabled:opacity-50 ${acc.color}`}
          >
            {loading === acc.email
              ? <Loader2 size={12} className="animate-spin" />
              : acc.label
            }
          </button>
        ))}
      </div>
    </div>
  );
};

export default Auth;
