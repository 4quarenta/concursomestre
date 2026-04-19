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

import React, { useEffect } from 'react';
import { X, Check, ArrowRight, Download, BookOpen } from 'lucide-react';
import { Material } from '@types';
import confetti from 'canvas-confetti';

interface SuccessModalProps {
    material: Material;
    onClose: () => void;
    onAccess: () => void;
}

export const SuccessModal: React.FC<SuccessModalProps> = ({ material, onClose, onAccess }) => {

    useEffect(() => {
        // Trigger confetti animation on mount
        const duration = 3000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 11000 };

        const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

        const interval: any = setInterval(function () {
            const timeLeft = animationEnd - Date.now();

            if (timeLeft <= 0) {
                return clearInterval(interval);
            }

            const particleCount = 50 * (timeLeft / duration);
            confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
            confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
        }, 250);

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md flex items-center justify-center z-[11000] p-4 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl max-w-md w-full relative overflow-hidden border border-white/20">

                {/* Decoratie Background Elements */}
                <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-emerald-500/20 to-transparent"></div>
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500/30 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-indigo-500/30 rounded-full blur-3xl"></div>

                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 rounded-full transition-colors z-20"
                >
                    <X size={20} className="text-slate-500 dark:text-slate-400" />
                </button>

                <div className="p-8 text-center relative z-10">
                    <div className="w-24 h-24 bg-gradient-to-tr from-emerald-400 to-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/30 animate-in zoom-in duration-500">
                        <Check size={48} className="text-white stroke-[3]" />
                    </div>

                    <h2 className="text-2xl font-black text-slate-800 dark:text-white mb-2">
                        Compra Realizada!
                    </h2>
                    <p className="text-slate-500 dark:text-slate-300 mb-8 leading-relaxed">
                        Você já tem acesso total ao material <br />
                        <span className="font-bold text-slate-800 dark:text-slate-100">"{material.title}"</span>
                    </p>

                    <div className="space-y-3">
                        <button
                            onClick={onAccess}
                            className="w-full py-4 px-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:-translate-y-1"
                        >
                            <BookOpen size={20} />
                            Acessar Agora
                        </button>

                        <button
                            onClick={onClose}
                            className="w-full py-4 px-6 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition-colors"
                        >
                            Continuar Navegando
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
