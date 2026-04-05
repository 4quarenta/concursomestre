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

import React, { useMemo } from 'react';
import { CheckCircle2, X, Star } from 'lucide-react';
import { Plan } from '@types';

interface PlanCardProps {
    plan: Plan;
    onSubscribe: (plan: Plan) => void;
    isCurrent?: boolean;
    isLoading?: boolean;
    isDisabled?: boolean;
    proRatedCredit?: number; // Added
}

export const PlanCard: React.FC<PlanCardProps> = ({ plan, onSubscribe, isCurrent, isLoading, isDisabled, proRatedCredit = 0 }) => {
    const isFree = plan.price === 0;

    // Clean up plan name (remove - Mensal, - Anual, etc)
    const displayName = useMemo(() => {
        return plan.name
            .replace(' - Mensal', '')
            .replace(' - Trimestral', '')
            .replace(' - Anual', '')
            .toUpperCase();
    }, [plan.name]);

    // Calculate monthly price and total
    const { monthlyPrice, totalPrice, isDiscounted, savings, discountLabel } = useMemo(() => {
        if (isFree) return { monthlyPrice: 0, totalPrice: 0, isDiscounted: false, savings: 0, discountLabel: '' };

        let monthly = plan.price;
        let total = plan.price;
        let discounted = false;
        let savingsVal = 0;
        let label = '';

        if (plan.interval_unit === 'year') {
            monthly = plan.price / 12;
            discounted = true;
            label = '30% OFF';
        } else if (plan.interval_unit === 'month' && plan.interval_count === 3) {
            monthly = plan.price / 3;
            discounted = true;
            label = '10% OFF';
        }

        return { monthlyPrice: monthly, totalPrice: total, isDiscounted: discounted, savings: savingsVal, discountLabel: label };
    }, [plan]);

    const finalPrice = Math.max(0, plan.price - proRatedCredit);
    const hasUpgradeDiscount = proRatedCredit > 0 && !isCurrent;

    return (
        <div className={`
            relative flex flex-col p-5 rounded-2xl transition-all duration-300 h-full
            ${isCurrent
                ? 'bg-white dark:bg-[#0f1020] border-2 border-indigo-500 shadow-xl shadow-indigo-500/10'
                : 'bg-white dark:bg-[#0f1020] border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-500/30 hover:shadow-xl hover:scale-[1.01]'
            }
        `}>
            {/* Header */}
            <div className="mb-4 text-center">
                {/* Badges */}
                <div className="flex flex-wrap justify-center gap-1.5 mb-3">
                    {isDiscounted && !isCurrent && (
                        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
                            {discountLabel || 'Economize'}
                        </div>
                    )}
                    {hasUpgradeDiscount && (
                        <div className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider flex items-center gap-1 animate-pulse">
                            <Star size={10} className="fill-indigo-400" /> Upgrade DisponÃ­vel
                        </div>
                    )}
                </div>

                <h3 className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-2 px-6">
                    {displayName}
                </h3>

                <div className="flex flex-col items-center">
                    <div className="flex items-baseline justify-center gap-1">
                        <span className="text-xs text-slate-500 dark:text-slate-500 font-bold">R$</span>
                        <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                            {isFree ? '0' : (hasUpgradeDiscount ? (finalPrice / (plan.interval_unit === 'year' ? 12 : (plan.interval_count || 1))) : monthlyPrice).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-500 font-bold uppercase">/mÃªs</span>
                    </div>

                    {hasUpgradeDiscount && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[9px] text-slate-500 line-through font-bold">R$ {monthlyPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            <span className="text-[9px] text-indigo-400 font-black px-1 py-0.5 bg-indigo-500/10 rounded">BÃ”NUS MIGRAÃ‡ÃƒO</span>
                        </div>
                    )}
                </div>

                {!isFree && (
                    <div className="mt-2 flex flex-col items-center">
                        <div className="flex items-center gap-2">
                            <p className={`text-[10px] font-medium uppercase tracking-wide ${hasUpgradeDiscount ? 'text-slate-500 line-through' : 'text-slate-500'}`}>
                                Total: R$ {totalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                            {hasUpgradeDiscount && (
                                <p className="text-[10px] font-black text-emerald-400 uppercase tracking-wide">
                                    Por R$ {finalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </p>
                            )}
                        </div>
                        {hasUpgradeDiscount && (
                            <p className="text-[9px] font-bold text-emerald-500 mt-0.5">
                                VocÃª economiza R$ {proRatedCredit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} hoje!
                            </p>
                        )}
                    </div>
                )}

                <p className="text-slate-500 dark:text-slate-400 text-xs mt-3 font-medium leading-relaxed min-h-[32px] line-clamp-2 px-2">
                    {plan.description}
                </p>
            </div>

            {/* Features */}
            <div className="flex-1 mb-6">
                <div className="h-px bg-slate-200 dark:bg-slate-800 w-full mb-4"></div>
                <ul className="space-y-2.5">
                    {plan.features && Array.isArray(plan.features) ? (
                        plan.features.map((feature, index) => (
                            <li key={index} className="flex items-start gap-2">
                                <CheckCircle2 className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${feature.included ? 'text-emerald-500' : 'text-slate-400 dark:text-slate-600'}`} />
                                <span className={`text-[11px] font-medium leading-tight ${feature.included ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-600 line-through'}`}>
                                    {feature.text}
                                </span>
                            </li>
                        ))
                    ) : (
                        // Fallback
                        Object.entries(plan.features || {}).map(([key, value]) => (
                            <li key={key} className="flex items-start gap-2">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                                <span className="text-slate-700 dark:text-slate-300 text-[11px]">
                                    <strong className="text-slate-900 dark:text-white capitalize">{key}:</strong> {String(value)}
                                </span>
                            </li>
                        ))
                    )}
                </ul>
            </div>

            {/* Button */}
            <button
                onClick={() => onSubscribe(plan)}
                disabled={isCurrent || isLoading || isDisabled}
                className={`
                    w-full py-2.5 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all duration-300
                    ${isCurrent || isDisabled
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-200 dark:border-slate-700'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 active:scale-95'
                    }
                `}
            >
                {isCurrent ? 'Plano Atual' : isDisabled ? 'IndisponÃ­vel' : isLoading ? 'Processando...' : 'Assinar Agora'}
            </button>
        </div>
    );
};
