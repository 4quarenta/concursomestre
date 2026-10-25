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


'use client';

import React, { FormEvent, useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { AlertCircle, Eye, EyeOff, Loader2, LogIn, Lock, Mail, Sparkles, UserPlus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import { useAuth } from '@providers/AuthProvider';
import { useAppConfigStore } from '@/state/app-config/appConfigStore';
import { apiClient, ENDPOINTS, readApiErrorMessage } from '@services/api';
import { authFlowService } from '@services/auth';
import { isCanonicalSessionData } from '@services/auth/session';
import { createSubmissionGate } from '@services/auth/submissionGate';
import { useRecaptchaV3 } from '@services/system/useRecaptchaV3';
import { hasInvalidGoogleClientIdCandidate, normalizeGoogleClientId } from '@/config/googleAuth';

type GoogleCredentialResponse = { credential?: string };
type GoogleIdentityClient = {
    initialize: (options: { client_id: string; callback: (response: GoogleCredentialResponse) => void; context?: 'signin'; ux_mode?: 'popup'; auto_select?: boolean }) => void;
    renderButton: (element: HTMLElement, options: { theme?: 'outline' | 'filled_black'; size?: 'large'; type?: 'standard'; shape?: 'rectangular'; text?: 'signin_with'; logo_alignment?: 'left'; width?: number }) => void;
};
type GoogleWindow = Window & { google?: { accounts?: { id?: GoogleIdentityClient } } };

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    description?: string;
    actionSource?: string;
    inlineLogin?: boolean;
}

const InlineLoginForm: React.FC<{ onClose: () => void; title: string; description: string }> = ({ onClose, title, description }) => {
    const router = useRouter();
    const { login } = useAuth();
    const systemSettings = useAppConfigStore((state) => state.systemSettings);
    const recaptchaEnabled = Boolean(systemSettings?.recaptchaEnabled && systemSettings?.recaptchaSiteKey);
    const { executeRecaptcha } = useRecaptchaV3({ enabled: recaptchaEnabled, siteKey: systemSettings?.recaptchaSiteKey });
    const googleClientRaw = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || systemSettings?.googleAuthClientId || '';
    const googleClientId = normalizeGoogleClientId(googleClientRaw);
    const googleEnabled = Boolean(googleClientId && !hasInvalidGoogleClientIdCandidate(googleClientRaw)
        && (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || systemSettings?.hasGoogleAuthClientConfigured));
    const submissionGateRef = useRef(createSubmissionGate());
    const googleButtonRef = useRef<HTMLDivElement>(null);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [twoFactorCode, setTwoFactorCode] = useState('');
    const [twoFactorEmail, setTwoFactorEmail] = useState('');
    const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [googleReady, setGoogleReady] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const identity = (window as GoogleWindow).google?.accounts?.id;
        const container = googleButtonRef.current;
        if (!googleReady || !googleEnabled || !identity || !container) return;

        container.innerHTML = '';
        identity.initialize({
            client_id: googleClientId,
            context: 'signin',
            ux_mode: 'popup',
            auto_select: false,
            callback: (response) => {
                const credential = response.credential;
                if (!credential) {
                    setError('Não foi possível ler a resposta do Google.');
                    return;
                }

                setError('');
                setGoogleLoading(true);
                void apiClient.post<{
                    success?: boolean;
                    message?: string;
                    data?: { require2FA?: boolean; email?: string; token?: string | null } & Record<string, unknown>;
                }>(ENDPOINTS.auth.google, { credential, createIfMissing: false })
                    .then(async (response) => {
                        const result = response as unknown as {
                            success?: boolean;
                            message?: string;
                            data?: { require2FA?: boolean; email?: string; token?: string | null } & Record<string, unknown>;
                        };
                        if (!result.success || !result.data) throw new Error(result.message || 'Não foi possível entrar com Google.');
                        if (result.data.require2FA) {
                            setTwoFactorEmail(result.data.email || '');
                            setRequiresTwoFactor(true);
                            return;
                        }
                        const token = result.data.token;
                        if (!isCanonicalSessionData(result.data)) throw new Error('A resposta de autenticação não trouxe uma sessão válida.');
                        await login(result.data, token);
                        onClose();
                    })
                    .catch((authError: unknown) => setError(readApiErrorMessage(authError, 'Não foi possível entrar com Google.')))
                    .finally(() => setGoogleLoading(false));
            },
        });
        identity.renderButton(container, {
            theme: document.documentElement.classList.contains('dark') ? 'filled_black' : 'outline',
            size: 'large',
            type: 'standard',
            shape: 'rectangular',
            text: 'signin_with',
            logo_alignment: 'left',
            width: Math.min(container.clientWidth || 360, 400),
        });

        return () => { container.innerHTML = ''; };
    }, [googleClientId, googleEnabled, googleReady, login, onClose]);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!submissionGateRef.current.tryStart()) return;
        setError('');
        setIsLoading(true);
        try {
            if (requiresTwoFactor) {
                if (!/^\d{6}$/.test(twoFactorCode)) {
                    setError('Informe o código de segurança de 6 dígitos.');
                    return;
                }
                const result = await authFlowService.verifyTwoFactor({ email: twoFactorEmail, code: twoFactorCode });
                if (!isCanonicalSessionData(result)) throw new Error('A resposta de autenticação não trouxe uma sessão válida.');
                await login(result, result.token);
                onClose();
                return;
            }
            if (!email.trim() || !password) {
                setError('Preencha e-mail e senha.');
                return;
            }
            const captchaToken = recaptchaEnabled ? await executeRecaptcha('auth_login') : null;
            const result = await authFlowService.login({ email: email.trim(), password, captchaToken });
            if (result.data.require2FA) {
                setTwoFactorEmail(result.data.email || email.trim());
                setRequiresTwoFactor(true);
                return;
            }
            if (!isCanonicalSessionData(result.data)) throw new Error('A resposta de autenticação não trouxe uma sessão válida.');
            await login(result.data, result.token);
            onClose();
        } catch (submitError: unknown) {
            setError(readApiErrorMessage(submitError, 'Não foi possível realizar o login agora.'));
        } finally {
            submissionGateRef.current.finish();
            setIsLoading(false);
        }
    };

    return (
        <div className="p-6 sm:p-7">
            <div className="mb-5 text-center">
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{title}</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    {requiresTwoFactor ? 'Confirme o código enviado para sua conta.' : description}
                </p>
            </div>
            {googleEnabled && (
                <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onReady={() => setGoogleReady(true)} />
            )}
            <form className="space-y-4" onSubmit={handleSubmit}>
                {requiresTwoFactor ? (
                    <label className="block text-left text-sm font-medium text-slate-700 dark:text-slate-300">
                        Código de segurança
                        <input autoComplete="one-time-code" inputMode="numeric" maxLength={6} value={twoFactorCode}
                            onChange={(event) => setTwoFactorCode(event.target.value.replace(/\D/g, ''))}
                            className="mt-1.5 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                            aria-label="Código de segurança de 6 dígitos" />
                    </label>
                ) : (
                    <>
                        <label className="block text-left text-sm font-medium text-slate-700 dark:text-slate-300">
                            E-mail
                            <span className="relative mt-1.5 block">
                                <Mail size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)}
                                    className="h-11 w-full rounded-md border border-slate-300 bg-white pl-10 pr-3 text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
                            </span>
                        </label>
                        <label className="block text-left text-sm font-medium text-slate-700 dark:text-slate-300">
                            Senha
                            <span className="relative mt-1.5 block">
                                <Lock size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={password}
                                    onChange={(event) => setPassword(event.target.value)}
                                    className="h-11 w-full rounded-md border border-slate-300 bg-white pl-10 pr-11 text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
                                <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
                                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                                </button>
                            </span>
                        </label>
                    </>
                )}
                {error && <p role="alert" className="flex items-start gap-2 rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-left text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300"><AlertCircle size={16} className="mt-0.5 shrink-0" />{error}</p>}
                <button type="submit" disabled={isLoading} className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60">
                    {isLoading ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}{requiresTwoFactor ? 'Confirmar e entrar' : 'Entrar na minha conta'}
                </button>
                {googleEnabled && !requiresTwoFactor && (
                    <>
                        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                            <span className="h-px bg-slate-200 dark:bg-slate-700" />ou<span className="h-px bg-slate-200 dark:bg-slate-700" />
                        </div>
                        <div className="relative min-h-11">
                            {googleLoading && <div className="absolute inset-0 z-10 flex items-center justify-center rounded-md bg-white/80 dark:bg-slate-900/80"><Loader2 size={18} className="animate-spin text-indigo-600" /></div>}
                            <div ref={googleButtonRef} className="flex min-h-11 w-full justify-center" />
                        </div>
                    </>
                )}
                <button type="button" onClick={() => { onClose(); router.push('/auth?mode=signup'); }}
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 font-semibold text-slate-800 transition hover:border-indigo-400 hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-indigo-500 dark:hover:text-indigo-300">
                    <UserPlus size={18} className="text-indigo-600 dark:text-indigo-400" />Criar conta grátis
                </button>
                <p className="flex items-center justify-center gap-1.5 pt-1 text-xs text-slate-500 dark:text-slate-400"><Sparkles size={13} className="text-amber-500" /> Ganhe 100 XP ao se cadastrar</p>
            </form>
        </div>
    );
};

const AuthModal: React.FC<AuthModalProps> = ({
    isOpen,
    onClose,
    title = "Acesso Restrito",
    description = "Para utilizar esta funcionalidade e salvar seu progresso, você precisa estar conectado à sua conta.",
    inlineLogin = true,
}) => {
    const router = useRouter();

    if (!isOpen) return null;

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div
                className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in slide-in-from-bottom-4 duration-500"
            >
                {/* Header Decorativo */}
                <div className="relative h-32 bg-indigo-600 dark:bg-indigo-500 flex items-center justify-center overflow-hidden">
                    <div className="absolute inset-0 opacity-10">
                        <div className="absolute top-0 left-0 w-20 h-20 bg-white rounded-full -translate-x-10 -translate-y-10" />
                        <div className="absolute bottom-0 right-0 w-32 h-32 bg-white rounded-full translate-x-16 translate-y-16" />
                    </div>
                    <div className="relative bg-white/20 p-4 rounded-2xl backdrop-blur-md border border-white/30 shadow-xl">
                        <Lock size={32} className="text-white" />
                    </div>
                    <button
                        onClick={onClose}
                        className="absolute top-6 right-6 p-2 rounded-full bg-black/10 text-white hover:bg-black/20 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {inlineLogin ? <InlineLoginForm onClose={onClose} title={title} description={description} /> : <div className="p-8 text-center space-y-6">
                    <div className="space-y-2">
                        <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">{title}</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                            {description}
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-3 pt-2">
                        <button
                            onClick={() => {
                                onClose();
                                router.push('/auth?mode=login');
                            }}
                            className="group flex items-center justify-center gap-3 w-full h-14 bg-slate-900 dark:bg-indigo-600 hover:bg-indigo-600 dark:hover:bg-indigo-700 text-white rounded-2xl font-black text-xs uppercase tracking-[0.15em] shadow-lg shadow-indigo-100 dark:shadow-none transition-all active:scale-95"
                        >
                            <LogIn size={18} className="group-hover:translate-x-1 transition-transform" />
                            Entrar na minha conta
                        </button>
                        <button
                            onClick={() => {
                                onClose();
                                router.push('/auth?mode=signup');
                            }}
                            className="group flex items-center justify-center gap-3 w-full h-14 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-600 text-slate-900 dark:text-slate-100 rounded-2xl font-black text-xs uppercase tracking-[0.15em] transition-all active:scale-95"
                        >
                            <UserPlus size={18} className="text-indigo-600" />
                            Criar conta gratuita
                        </button>
                    </div>

                    <div className="pt-4 flex items-center justify-center gap-2 text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest">
                        <Sparkles size={12} className="text-amber-400" />
                        Ganhe 100 XP ao se cadastrar
                    </div>
                </div>}
            </div>
        </div>,
        document.body
    );
};

export default React.memo(AuthModal);
