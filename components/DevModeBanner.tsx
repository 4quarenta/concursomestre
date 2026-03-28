
import React, { useState } from 'react';
import {
    Terminal, ChevronDown, ChevronUp, Zap, User, Shield, ShoppingBag,
    Mail, Database, Globe, X
} from 'lucide-react';
import { useData } from '../context/DataContext';

/**
 * DevModeBanner
 * Exibido globalmente quando appMode === 'development'.
 * Mostra o modo atual e informações de debug úteis para desenvolvimento.
 * Totalmente oculto em produção.
 */
const DevModeBanner: React.FC = () => {
    const { systemSettings } = useData();
    const [expanded, setExpanded] = useState(false);
    const [dismissed, setDismissed] = useState(false);

    // Oculta em produção ou se dispensado
    if (systemSettings?.appMode === 'production' || dismissed) return null;

    const smtpConfigured = !!(systemSettings?.smtpHost && systemSettings?.smtpUser);
    const apiKeySet = !!(systemSettings?.geminiApiKey);

    return (
        <div className="fixed bottom-0 left-0 right-0 z-[9998] pointer-events-none">
            <div className="pointer-events-auto mx-auto max-w-screen-2xl px-4 pb-4">
                <div className="bg-amber-500 dark:bg-amber-600 text-amber-950 rounded-2xl shadow-2xl overflow-hidden border border-amber-400">
                    {/* Barra principal */}
                    <div className="flex items-center justify-between px-4 py-2.5 gap-3">
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                            <Terminal size={16} className="flex-shrink-0" />
                            <span className="font-black text-xs uppercase tracking-widest">Modo Desenvolvimento</span>
                            <span className="hidden sm:flex items-center gap-1.5 flex-wrap">
                                <span className="bg-amber-400/60 text-[10px] font-mono px-2 py-0.5 rounded-full">
                                    e-mails: apenas log
                                </span>
                                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${smtpConfigured ? 'bg-emerald-200/60' : 'bg-red-200/60'}`}>
                                    SMTP: {smtpConfigured ? 'configurado' : 'não configurado'}
                                </span>
                                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${apiKeySet ? 'bg-emerald-200/60' : 'bg-red-200/60'}`}>
                                    Gemini AI: {apiKeySet ? 'ativo' : 'sem chave'}
                                </span>
                            </span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                                onClick={() => setExpanded(!expanded)}
                                className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest hover:opacity-70 transition-opacity"
                            >
                                {expanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                                {expanded ? 'Recolher' : 'Detalhes'}
                            </button>
                            <button
                                onClick={() => setDismissed(true)}
                                className="p-1 hover:opacity-70 transition-opacity"
                                title="Dispensar (sessão atual)"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    </div>

                    {/* Painel expandido */}
                    {expanded && (
                        <div className="border-t border-amber-400 bg-amber-400/30 px-4 py-3">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px] font-mono">
                                <div className="flex items-center gap-1.5">
                                    <Globe size={12} />
                                    <span>APP_ENV: <strong>development</strong></span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Mail size={12} />
                                    <span>SMTP: {smtpConfigured ? systemSettings?.smtpHost : '—'}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Database size={12} />
                                    <span>PIX: {systemSettings?.pixKey ? 'configurado' : '—'}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Zap size={12} />
                                    <span>Gemini: {apiKeySet ? 'ok' : 'sem chave'}</span>
                                </div>
                            </div>

                            <div className="mt-3 border-t border-amber-400/40 pt-3">
                                <p className="text-[10px] font-bold opacity-70 uppercase tracking-widest mb-2">Logins rápidos (dev only)</p>
                                <div className="flex flex-wrap gap-2">
                                    <QuickLoginButton role="Aluno" email="aluno@email.com" icon={<User size={11} />} />
                                    <QuickLoginButton role="Admin" email="admin@concursomestre.com" icon={<Shield size={11} />} />
                                    <QuickLoginButton role="Parceiro" email="prof@concursomestre.com" icon={<ShoppingBag size={11} />} />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

/** Botão de login rápido que redireciona para /auth com parâmetro de preenchimento */
const QuickLoginButton: React.FC<{ role: string; email: string; icon: React.ReactNode }> = ({ role, email, icon }) => {
    const handleClick = () => {
        // Salva credenciais de dev no sessionStorage para pré-preencher o formulário
        sessionStorage.setItem('dev_prefill_email', email);
        sessionStorage.setItem('dev_prefill_password', '123456');
        window.location.hash = '/auth?mode=login&dev=1';
    };

    return (
        <button
            onClick={handleClick}
            className="flex items-center gap-1.5 bg-amber-950/20 hover:bg-amber-950/30 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-colors"
        >
            {icon} {role} <span className="opacity-60 font-mono">{email}</span>
        </button>
    );
};

export default DevModeBanner;
