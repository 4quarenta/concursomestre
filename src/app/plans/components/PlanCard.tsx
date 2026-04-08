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
import { CheckCircle2, Crown, Sparkles, Star } from 'lucide-react';
import { Plan } from '@types';
import { getCanonicalPlanName } from '@services/plans/planAccess';

interface PlanCardProps {
    plan: Plan;
    onSubscribe: (plan: Plan) => void;
    isCurrent?: boolean;
    isLoading?: boolean;
    isDisabled?: boolean;
    proRatedCredit?: number;
}

export const PlanCard: React.FC<PlanCardProps> = ({ plan, onSubscribe, isCurrent, isLoading, isDisabled, proRatedCredit = 0 }) => {
    const isFree = plan.price === 0;
    const canonicalPlanName = getCanonicalPlanName(plan.name);
    const isProPlan = canonicalPlanName === 'Pro';
    const isElitePlan = canonicalPlanName === 'Elite';

    const displayName = useMemo(() => {
        return plan.name
            .replace(' - Mensal', '')
            .replace(' - Trimestral', '')
            .replace(' - Anual', '')
            .toUpperCase();
    }, [plan.name]);

    const { monthlyPrice, totalPrice, isDiscounted, discountLabel } = useMemo(() => {
        if (isFree) return { monthlyPrice: 0, totalPrice: 0, isDiscounted: false, discountLabel: '' };

        let monthly = plan.price;
        let total = plan.price;
        let discounted = false;
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

        return { monthlyPrice: monthly, totalPrice: total, isDiscounted: discounted, discountLabel: label };
    }, [isFree, plan]);

    const finalPrice = Math.max(0, plan.price - proRatedCredit);
    const hasUpgradeDiscount = proRatedCredit > 0 && !isCurrent;

    const cardClassName = isCurrent
        ? 'bg-white dark:bg-[#0f1020] border-2 border-indigo-500 shadow-xl shadow-indigo-500/10'
        : isElitePlan
            ? 'bg-white dark:bg-[#0f1020] border-2 border-amber-400 shadow-xl shadow-amber-500/15 hover:border-amber-300 hover:shadow-2xl hover:scale-[1.015]'
            : isProPlan
                ? 'bg-white dark:bg-[#0f1020] border-2 border-indigo-300 shadow-xl shadow-indigo-500/10 hover:border-indigo-400 hover:shadow-2xl hover:scale-[1.015]'
                : 'bg-white dark:bg-[#0f1020] border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-500/30 hover:shadow-xl hover:scale-[1.01]';

    const titleClassName = isElitePlan ? 'text-amber-600 dark:text-amber-300' : 'text-indigo-600 dark:text-indigo-400';

    const buttonClassName = isCurrent || isDisabled
        ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-200 dark:border-slate-700'
        : isElitePlan
            ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40 active:scale-95'
            : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 active:scale-95';

    return (
        <div className={`relative flex flex-col rounded-2xl p-5 transition-all duration-300 h-full ${cardClassName}`}>
            <div className="mb-4 text-center">
                <div className="mb-3 flex flex-wrap justify-center gap-1.5">
                    {isProPlan && !isCurrent && (
                        <div className="flex items-center gap-1 rounded border border-indigo-500/20 bg-indigo-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-indigo-500 dark:text-indigo-300">
                            <Sparkles size={10} />
                            Mais Vendido
                        </div>
                    )}
                    {isElitePlan && !isCurrent && (
                        <div className="flex items-center gap-1 rounded border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-300">
                            <Crown size={10} className="fill-current" />
                            Maximo
                        </div>
                    )}
                    {isDiscounted && !isCurrent && (
                        <div className="rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-400">
                            {discountLabel || 'Economize'}
                        </div>
                    )}
                    {hasUpgradeDiscount && (
                        <div className="flex items-center gap-1 rounded border border-indigo-500/20 bg-indigo-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-indigo-400 animate-pulse">
                            <Star size={10} className="fill-indigo-400" />
                            Upgrade Disponivel
                        </div>
                    )}
                </div>

                <h3 className={`mb-2 px-6 text-xs font-black uppercase tracking-widest ${titleClassName}`}>
                    {displayName}
                </h3>

                <div className="flex flex-col items-center">
                    <div className="flex items-baseline justify-center gap-1">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-500">R$</span>
                        <span className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                            {isFree ? '0' : (hasUpgradeDiscount ? (finalPrice / (plan.interval_unit === 'year' ? 12 : (plan.interval_count || 1))) : monthlyPrice).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-500">/mes</span>
                    </div>

                    {hasUpgradeDiscount && (
                        <div className="mt-0.5 flex items-center gap-1.5">
                            <span className="text-[9px] font-bold text-slate-500 line-through">R$ {monthlyPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            <span className="rounded bg-indigo-500/10 px-1 py-0.5 text-[9px] font-black text-indigo-400">BONUS MIGRACAO</span>
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
                                <p className="text-[10px] font-black uppercase tracking-wide text-emerald-400">
                                    Por R$ {finalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </p>
                            )}
                        </div>
                        {hasUpgradeDiscount && (
                            <p className="mt-0.5 text-[9px] font-bold text-emerald-500">
                                Voce economiza R$ {proRatedCredit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} hoje!
                            </p>
                        )}
                    </div>
                )}

                <p className="mt-3 min-h-[32px] line-clamp-2 px-2 text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                    {plan.description}
                </p>
            </div>

            <div className="mb-6 flex-1">
                <div className="mb-4 h-px w-full bg-slate-200 dark:bg-slate-800"></div>
                <ul className="space-y-2.5">
                    {plan.features && Array.isArray(plan.features) ? (
                        plan.features.map((feature, index) => (
                            <li key={index} className="flex items-start gap-2">
                                <CheckCircle2 className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${feature.included ? 'text-emerald-500' : 'text-slate-400 dark:text-slate-600'}`} />
                                <span className={`text-[11px] font-medium leading-tight ${feature.included ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-600 line-through'}`}>
                                    {feature.text}
                                </span>
                            </li>
                        ))
                    ) : (
                        Object.entries(plan.features || {}).map(([key, value]) => (
                            <li key={key} className="flex items-start gap-2">
                                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                                <span className="text-[11px] text-slate-700 dark:text-slate-300">
                                    <strong className="capitalize text-slate-900 dark:text-white">{key}:</strong> {String(value)}
                                </span>
                            </li>
                        ))
                    )}
                </ul>
            </div>

            <button
                onClick={() => onSubscribe(plan)}
                disabled={isCurrent || isLoading || isDisabled}
                className={`w-full rounded-lg py-2.5 text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${buttonClassName}`}
            >
                {isCurrent ? 'Assinatura Atual' : isDisabled ? 'Indisponivel' : isLoading ? 'Processando...' : 'Assinar Agora'}
            </button>
        </div>
    );
};
