import React from 'react';
import { createPortal } from 'react-dom';
import { Crown, CheckCircle2, X, Sparkles, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface UpgradeModalProps {
    isOpen: boolean;
    onClose: () => void;
    requiredPlan: 'Pro' | 'Elite';
    featureName: string;
}

const UpgradeModal: React.FC<UpgradeModalProps> = ({
    isOpen,
    onClose,
    requiredPlan,
    featureName
}) => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();

    if (!isOpen) return null;

    const benefits = requiredPlan === 'Elite'
        ? ['Acesso ilimitado ao Raio-X da Banca', 'Mentoria Mensal com Aprovados', 'Simulados 100% Personalizados', 'Ranking com projeção de nota']
        : ['Resolução ilimitada de questões', 'Sem propagandas', 'Comentários de professores', 'Estatísticas básicas'];

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div
                className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in slide-in-from-bottom-4 duration-500 relative"
            >
                {/* Header Decorativo */}
                <div className="relative h-36 bg-slate-900 dark:bg-indigo-950 flex items-center justify-center overflow-hidden">
                    <div className="absolute inset-0 opacity-20">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500 rounded-full blur-[50px]" />
                        <div className="absolute bottom-0 left-0 w-32 h-32 bg-amber-500 rounded-full blur-[50px]" />
                    </div>

                    <div className="relative flex flex-col items-center gap-2 z-10">
                        <div className={`p-4 rounded-3xl backdrop-blur-md border shadow-xl ${requiredPlan === 'Elite' ? 'bg-amber-500/20 border-amber-500/40 text-amber-500' : 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400'}`}>
                            <Crown size={40} className="animate-pulse" />
                        </div>
                        <span className={`text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full border ${requiredPlan === 'Elite' ? 'bg-amber-950/40 border-amber-500/30 text-amber-400' : 'bg-indigo-950/40 border-indigo-500/30 text-indigo-300'}`}>
                            Recurso {requiredPlan}
                        </span>
                    </div>

                    <button
                        onClick={onClose}
                        className="absolute top-6 right-6 p-2 rounded-full bg-black/20 text-white hover:bg-black/30 transition-colors backdrop-blur-sm"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-8 space-y-6">
                    <div className="text-center space-y-2">
                        <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 leading-tight">
                            Desbloqueie {featureName}
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                            {currentUser ? `Você está no plano ${(currentUser.subscription?.status === 'active' || currentUser.subscription?.status === 'trialing') ? ((currentUser as any).subscription?.plan?.name || (currentUser as any).plan) : 'Gratuito'}. ` : ''}
                            Faça o upgrade para acessar essa e outras ferramentas exclusivas.
                        </p>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-5 border border-slate-100 dark:border-slate-800">
                        <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 text-center">Incluso no plano {requiredPlan}</p>
                        <ul className="space-y-3">
                            {benefits.map((benefit, i) => (
                                <li key={i} className="flex items-start gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                                    <CheckCircle2 size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                                    {benefit}
                                </li>
                            ))}
                        </ul>
                    </div>

                    <button
                        onClick={() => {
                            onClose();
                            // Se estiver logado vai para profile (onde tem change plan), se não, auth com register
                            if (currentUser) {
                                navigate('/profile');
                            } else {
                                navigate('/auth?register=true');
                            }
                        }}
                        className={`group flex items-center justify-center gap-3 w-full h-14 text-white rounded-2xl font-black text-xs uppercase tracking-[0.15em] shadow-lg transition-all active:scale-95 ${requiredPlan === 'Elite' ? 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 shadow-amber-900/20' : 'bg-slate-900 dark:bg-indigo-600 hover:bg-indigo-600 dark:hover:bg-indigo-500'}`}
                    >
                        {requiredPlan === 'Elite' ? <Sparkles size={16} /> : <Crown size={16} />}
                        {currentUser ? 'Fazer Upgrade Agora' : 'Começar Gratuitamente'}
                    </button>

                    {!currentUser && (
                        <button onClick={() => { onClose(); navigate('/auth'); }} className="w-full text-center text-[10px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 uppercase tracking-widest transition-colors">
                            Já sou assinante
                        </button>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default React.memo(UpgradeModal);
