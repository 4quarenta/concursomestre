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
import { createPortal } from 'react-dom';
import { AlertTriangle, ChevronRight, CreditCard, X } from 'lucide-react';
import type { Material } from '@types';

type PaymentModalUser = {
    id?: string;
    name?: string;
    email?: string;
} | null;

interface PaymentModalProps {
    material: Material;
    currentUser: PaymentModalUser;
    onClose: () => void;
    onSuccess: () => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
    material,
    currentUser,
    onClose,
}) => {
    void currentUser;

    return createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 lg:p-8">
            <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={onClose} />

            <div className="relative w-full max-w-2xl overflow-hidden rounded-[2.25rem] border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5 dark:border-slate-800">
                    <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-600 dark:text-amber-300">
                            Pagamentos em transicao
                        </p>
                        <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">
                            Checkout indisponivel
                        </h2>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl border border-slate-200 p-2 text-slate-500 transition-all hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                        <X size={16} />
                    </button>
                </div>

                <div className="space-y-6 px-6 py-6">
                    <div className="flex items-start gap-4 rounded-[1.5rem] border border-amber-200 bg-amber-50 px-4 py-4 dark:border-amber-500/20 dark:bg-amber-500/10">
                        <div className="rounded-2xl bg-amber-500 p-2.5 text-white shadow-lg shadow-amber-500/20">
                            <AlertTriangle size={18} />
                        </div>
                        <div className="space-y-2">
                            <p className="text-sm font-black text-slate-900 dark:text-slate-100">
              A integracao anterior foi removida.
                            </p>
                            <p className="text-xs font-medium leading-5 text-slate-600 dark:text-slate-300">
                                O material <strong>{material.title}</strong> continuara visivel, mas novas compras ficam pausadas ate a entrada do novo fluxo oficial.
                            </p>
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-800/40">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                                Material
                            </p>
                            <p className="mt-2 text-base font-black text-slate-900 dark:text-slate-100">
                                {material.title}
                            </p>
                        </div>

                        <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-800/40">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                                Valor
                            </p>
                            <p className="mt-2 text-base font-black text-slate-900 dark:text-slate-100">
                                R$ {Number(material.price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                        </div>
                    </div>

                    <div className="rounded-[1.5rem] border border-indigo-200 bg-indigo-50 px-4 py-4 dark:border-indigo-500/20 dark:bg-indigo-500/10">
                        <div className="flex items-start gap-3">
                            <div className="rounded-2xl bg-indigo-600 p-2.5 text-white shadow-lg shadow-indigo-500/20">
                                <CreditCard size={18} />
                            </div>
                            <div className="space-y-2">
                                <p className="text-sm font-black text-slate-900 dark:text-slate-100">
                                    Proximo passo
                                </p>
                                <p className="text-xs font-medium leading-5 text-slate-600 dark:text-slate-300">
                                    O marketplace ficara sem checkout ate a plataforma receber o novo provedor de pagamento.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end border-t border-slate-100 px-6 py-4 dark:border-slate-800">
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 text-[10px] font-black uppercase tracking-[0.16em] text-white transition-all hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900"
                    >
                        Fechar
                        <ChevronRight size={14} />
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
};
