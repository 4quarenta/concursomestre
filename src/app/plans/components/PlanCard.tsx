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
import { CheckCircle2, Star } from 'lucide-react';
import type { Plan, PlanFeature } from '@types';
import type { ResolvedPlanOffer } from '@services/plans';

interface PlanCardProps {
  plan: Plan;
  displayName?: string;
  offer?: ResolvedPlanOffer;
  onSubscribe: (plan: Plan) => void;
  isCurrent?: boolean;
  isLoading?: boolean;
  isDisabled?: boolean;
  proRatedCredit?: number;
  featuresOverride?: PlanFeature[];
}

export const PlanCard: React.FC<PlanCardProps> = ({
  plan,
  displayName,
  offer,
  onSubscribe,
  isCurrent,
  isLoading,
  isDisabled,
  proRatedCredit = 0,
  featuresOverride,
}) => {
  const isFree = plan.price === 0;

  const resolvedDisplayName = useMemo(() => {
    const fallbackName = plan.name
      .replace(' - Mensal', '')
      .replace(' - Trimestral', '')
      .replace(' - Anual', '');

    return (displayName || fallbackName).trim().toUpperCase();
  }, [displayName, plan.name]);

  const billingSuffixLabel = useMemo(() => {
    const unit = String(plan.interval_unit || '').toLowerCase();
    const count = Math.max(1, Number(plan.interval_count || 1));

    if (unit === 'day') {
      return count === 1 ? '/dia' : `/${count} dias`;
    }

    if (unit === 'week') {
      return count === 1 ? '/semana' : `/${count} semanas`;
    }

    return '/mes';
  }, [plan.interval_count, plan.interval_unit]);

  const { monthlyPrice, totalPrice, originalMonthlyPrice, originalTotalPrice, isDiscounted, discountLabel } = useMemo(() => {
    if (isFree) {
      return {
        monthlyPrice: 0,
        totalPrice: 0,
        originalMonthlyPrice: 0,
        originalTotalPrice: 0,
        isDiscounted: false,
        discountLabel: '',
      };
    }

    const fallbackCycleDivisor = plan.interval_unit === 'year'
      ? 12
      : plan.interval_unit === 'month'
        ? (plan.interval_count || 1)
        : 1;
    const resolvedOffer = offer || null;
    const resolvedMonthlyPrice = resolvedOffer?.discountedMonthlyAmount ?? (plan.price / fallbackCycleDivisor);
    const resolvedTotalPrice = resolvedOffer?.discountedCycleAmount ?? plan.price;
    const resolvedOriginalMonthlyPrice = resolvedOffer?.originalMonthlyAmount ?? resolvedMonthlyPrice;
    const resolvedOriginalTotalPrice = resolvedOffer?.originalCycleAmount ?? plan.price;
    const resolvedDiscountPercent = resolvedOffer?.effectiveDiscountPercent ?? 0;

    return {
      monthlyPrice: resolvedMonthlyPrice,
      totalPrice: resolvedTotalPrice,
      originalMonthlyPrice: resolvedOriginalMonthlyPrice,
      originalTotalPrice: resolvedOriginalTotalPrice,
      isDiscounted: Boolean(resolvedOffer?.hasDiscount),
      discountLabel: resolvedDiscountPercent > 0 ? `${resolvedDiscountPercent}% OFF` : '',
    };
  }, [isFree, offer, plan]);

  const cycleDivisor = offer?.cycleCount || (
    plan.interval_unit === 'year'
      ? 12
      : plan.interval_unit === 'month'
        ? (plan.interval_count || 1)
        : 1
  );
  const finalPrice = Math.max(0, totalPrice - proRatedCredit);
  const hasUpgradeDiscount = proRatedCredit > 0 && !isCurrent && !isDisabled;
  const displayMonthlyPrice = hasUpgradeDiscount ? finalPrice / cycleDivisor : monthlyPrice;
  const displayFeatures = Array.isArray(featuresOverride) && featuresOverride.length > 0
    ? featuresOverride
    : Array.isArray(plan.features)
      ? plan.features
      : [];

  return (
    <div
      className={`
        relative flex h-full flex-col rounded-2xl p-5 transition-all duration-300
        ${isCurrent
          ? 'border-2 border-indigo-500 bg-white shadow-xl shadow-indigo-500/10 dark:bg-[#0f1020]'
          : 'border border-slate-200 bg-white hover:scale-[1.01] hover:border-indigo-300 hover:shadow-xl dark:border-slate-800 dark:bg-[#0f1020] dark:hover:border-indigo-500/30'
        }
      `}
    >
      <div className="mb-4 text-center">
        <div className="mb-3 flex flex-wrap justify-center gap-1.5">
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

        <h3 className="mb-2 px-6 text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
          {resolvedDisplayName}
        </h3>

        <div className="flex flex-col items-center">
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-500">R$</span>
            <span className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              {isFree
                ? '0'
                : displayMonthlyPrice.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
            </span>
            <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-500">{billingSuffixLabel}</span>
          </div>

          {hasUpgradeDiscount && (
            <div className="mt-0.5 flex items-center gap-1.5">
              <span className="text-[9px] font-bold text-slate-500 line-through">
                R$ {monthlyPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
              <span className="rounded bg-indigo-500/10 px-1 py-0.5 text-[9px] font-black text-indigo-400">
                BONUS MIGRACAO
              </span>
            </div>
          )}

          {isDiscounted && !hasUpgradeDiscount && (
            <div className="mt-0.5 flex items-center gap-1.5">
              <span className="text-[9px] font-bold text-slate-500 line-through">
                R$ {originalMonthlyPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}
        </div>

        {!isFree && (
          <div className="mt-2 flex flex-col items-center">
            <div className="flex items-center gap-2">
              <p className={`text-[10px] font-medium uppercase tracking-wide ${(hasUpgradeDiscount || isDiscounted) ? 'text-slate-500 line-through' : 'text-slate-500'}`}>
                Total: R$ {(isDiscounted ? originalTotalPrice : totalPrice).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              {(hasUpgradeDiscount || isDiscounted) && (
                <p className="text-[10px] font-black uppercase tracking-wide text-emerald-400">
                  Por R$ {finalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              )}
            </div>
            {(hasUpgradeDiscount || isDiscounted) && (
              <p className="mt-0.5 text-[9px] font-bold text-emerald-500">
                Voce economiza R$ {((isDiscounted ? (originalTotalPrice - totalPrice) : 0) + (hasUpgradeDiscount ? proRatedCredit : 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} hoje!
              </p>
            )}
          </div>
        )}

        <p className="mt-3 min-h-[32px] px-2 text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400 line-clamp-2">
          {plan.description}
        </p>
      </div>

      <div className="mb-6 flex-1">
        <div className="mb-4 h-px w-full bg-slate-200 dark:bg-slate-800" />
        <ul className="space-y-2.5">
          {displayFeatures.map((feature, index) => (
                <li key={index} className="flex items-start gap-2">
                  <CheckCircle2
                    className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${feature.included ? 'text-emerald-500' : 'text-slate-400 dark:text-slate-600'}`}
                  />
                  <span
                    className={`text-[11px] font-medium leading-tight ${
                      feature.included ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 line-through dark:text-slate-600'
                    }`}
                  >
                    {feature.text}
                  </span>
                </li>
          ))}
        </ul>
      </div>

      <button
        onClick={() => onSubscribe(plan)}
        disabled={isCurrent || isLoading || isDisabled}
        className={[
          'w-full rounded-lg py-2.5 text-[10px] font-black uppercase tracking-widest transition-all duration-300',
          isCurrent || isDisabled
            ? 'cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500'
            : 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-500 hover:shadow-indigo-500/40 active:scale-95',
        ].join(' ')}
      >
        {isCurrent ? 'Plano Atual' : isDisabled ? 'Indisponivel' : isLoading ? 'Processando...' : 'Assinar Agora'}
      </button>
    </div>
  );
};

export default PlanCard;
