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


import React from 'react';
import { AlertTriangle, X, Info, Trash2 } from 'lucide-react';

interface ConfirmModalProps {
    isOpen: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    title?: string;
    description?: string;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'warning' | 'info';
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen,
    onConfirm,
    onCancel,
    title = "Confirmar Ação",
    description = "Você tem certeza que deseja prosseguir?",
    confirmText = "Confirmar",
    cancelText = "Cancelar",
    type = 'info'
}) => {
    if (!isOpen) return null;

    const getIcon = () => {
        switch (type) {
            case 'danger': return <Trash2 size={32} className="text-red-500" />;
            case 'warning': return <AlertTriangle size={32} className="text-amber-500" />;
            default: return <Info size={32} className="text-indigo-500" />;
        }
    };

    const getButtonClass = () => {
        switch (type) {
            case 'danger': return "bg-red-600 hover:bg-red-700 shadow-red-100 dark:shadow-none";
            case 'warning': return "bg-amber-600 hover:bg-amber-700 shadow-amber-100 dark:shadow-none";
            default: return "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100 dark:shadow-none";
        }
    };

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in zoom-in slide-in-from-bottom-4 duration-500">

                <div className="p-8 text-center space-y-6">
                    <div className="mx-auto w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-3xl flex items-center justify-center border border-slate-100 dark:border-slate-700 shadow-inner">
                        {getIcon()}
                    </div>

                    <div className="space-y-2">
                        <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">{title}</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                            {description}
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                        <button
                            onClick={onCancel}
                            className="h-14 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-100 dark:hover:bg-slate-700 transition-all active:scale-95"
                        >
                            {cancelText}
                        </button>
                        <button
                            onClick={onConfirm}
                            className={`h-14 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 shadow-lg ${getButtonClass()}`}
                        >
                            {confirmText}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default React.memo(ConfirmModal);
