import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2, ArrowRight, BrainCircuit, Gift } from 'lucide-react';
import { apiClient, ENDPOINTS } from '../src/core/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const ConfirmEmail: React.FC = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const navigate = useNavigate();
    const { currentUser, refreshUser, isLoading: authLoading } = useAuth();
    const { addToast } = useToast();

    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [message, setMessage] = useState('Verificando seu e-mail...');
    const [xpGained, setXpGained] = useState(0);
    const [countdown, setCountdown] = useState(5);
    const hasFetched = useRef(false);

    useEffect(() => {
        if (!token) {
            if (authLoading) return;

            if (currentUser && !currentUser.emailVerified) {
                setStatus('loading');
                setMessage('Confirme seu e-mail para desbloquear todos os recursos.');
                return;
            }
            setStatus('error');
            setMessage('Token de verificação inválido ou ausente da URL.');
            return;
        }

        if (hasFetched.current) return;
        hasFetched.current = true;

        const confirmEmail = async () => {
            try {
                const response: any = await apiClient.post(
                    ENDPOINTS.auth.confirmEmail || 'auth/confirm-email.php',
                    { token }
                );

                if (response.success) {
                    setStatus('success');
                    setMessage(response.message || 'E-mail verificado com sucesso!');

                    // Atualiza o XP exibido na tela
                    if (response.data?.newXp !== undefined) {
                        setXpGained(50);
                    }

                    // Mostra toast de sucesso
                    addToast('🎉 Conta ativada! Você ganhou +50 XP de bônus!', 'success');

                    // Atualiza o usuário no AuthContext para sumir o banner
                    if (localStorage.getItem('token')) {
                        await refreshUser();
                    }

                    // Redirecionamento automático após 5 segundos
                    let count = 5;
                    const timer = setInterval(() => {
                        count--;
                        setCountdown(count);
                        if (count <= 0) {
                            clearInterval(timer);
                            navigate(currentUser ? '/' : '/auth');
                        }
                    }, 1000);

                    return () => clearInterval(timer);
                } else {
                    setStatus('error');
                    setMessage(response.message || 'Erro ao verificar e-mail.');
                }
            } catch (err: any) {
                setStatus('error');
                setMessage(err?.message || 'Erro de conexão com o servidor. O link pode ter expirado.');
            }
        };

        confirmEmail();
    }, [token]);

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
                                        Bem-vindo(a) ao Time! 🚀
                                    </h2>
                                    <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed max-w-xs mx-auto">
                                        Enviamos um link de confirmação para <strong>{currentUser.email}</strong>. Confirme para desbloquear questões, simulados e rankings.
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
                        {/* Ícone de sucesso */}
                        <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center ring-4 ring-emerald-100 dark:ring-emerald-900/30">
                            <CheckCircle2 size={40} />
                        </div>

                        <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">
                            Conta Ativada! 🎉
                        </h2>

                        <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed max-w-xs">
                            {message}
                        </p>

                        {xpGained > 0 && (
                            <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 px-4 py-2 rounded-xl text-sm font-bold shadow-sm">
                                <Gift size={16} />
                                +{xpGained} XP de Bônus Recebido!
                            </div>
                        )}

                        {/* Countdown + botão manual */}
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
                            onClick={() => currentUser ? navigate('/') : navigate('/auth?mode=login')}
                            className="mt-4 w-full h-12 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 font-black rounded-2xl text-xs uppercase tracking-widest transition-all shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-center"
                        >
                            {currentUser ? 'Voltar ao Início' : 'Voltar para o Login'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ConfirmEmail;
