
import React from 'react';
import ReactDOM from 'react-dom';
import { LogIn, UserPlus, X, Lock, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    description?: string;
    actionSource?: string;
}

const AuthModal: React.FC<AuthModalProps> = ({
    isOpen,
    onClose,
    title = "Acesso Restrito",
    description = "Para utilizar esta funcionalidade e salvar seu progresso, você precisa estar conectado à sua conta.",
    actionSource = "funcionalidade"
}) => {
    const navigate = useNavigate();

    if (!isOpen) return null;

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div
                className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in slide-in-from-bottom-4 duration-500"
            >
                {/* Header Decorativo */}
                <div className="relative h-32 bg-indigo-600 dark:bg-indigo-500 flex items-center justify-center overflow-hidden">
                    <div className="absolute inset-0 opacity-10">
                        <div className="absolute top-0 left-0 w-20 h-20 bg-white rounded-full -translate-x-10 -translate-y-10" />
                        <div className="absolute bottom-0 right-0 w-32 h-32 bg-white rounded-full translate-x-16 translate-y-16" />
                    </div>
                    <div className="relative bg-white/20 p-4 rounded-3xl backdrop-blur-md border border-white/30 shadow-xl">
                        <Lock size={32} className="text-white" />
                    </div>
                    <button
                        onClick={onClose}
                        className="absolute top-6 right-6 p-2 rounded-full bg-black/10 text-white hover:bg-black/20 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-8 text-center space-y-6">
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
                                navigate('/auth?mode=login');
                            }}
                            className="group flex items-center justify-center gap-3 w-full h-14 bg-slate-900 dark:bg-indigo-600 hover:bg-indigo-600 dark:hover:bg-indigo-700 text-white rounded-2xl font-black text-xs uppercase tracking-[0.15em] shadow-lg shadow-indigo-100 dark:shadow-none transition-all active:scale-95"
                        >
                            <LogIn size={18} className="group-hover:translate-x-1 transition-transform" />
                            Entrar na minha conta
                        </button>
                        <button
                            onClick={() => {
                                onClose();
                                navigate('/auth?mode=signup');
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
                </div>
            </div>
        </div>,
        document.body
    );
};

export default React.memo(AuthModal);
