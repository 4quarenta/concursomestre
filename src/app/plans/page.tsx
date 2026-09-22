'use client';

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


import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@providers/AuthProvider';
import type { Plan, PlanName } from '@types';
import { planService } from '@services/plans';
import { calculateSubscriptionProRatedCredit, getCanonicalPlanName, getConfiguredPlanDisplayName, hasActivePlanAccess, isPlanEnabledByName, resolvePlanAutoCouponsById, resolvePlanCycleKey, resolvePlanDiscountBadgesByCycle, resolvePlanOffer } from '@services/plans';
import { resolveSystemFeatureFlag } from '@services/system/moduleFlags';
import { PlanCard } from './components/PlanCard';
import { useToast } from '@providers/ToastProvider';
import { ArrowLeft, ArrowRight, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { buildProfilePath } from '../profile/profileNavigation';
import { useAppConfigStore } from '@/state/app-config/appConfigStore';
import { getPublicPlanFeaturesForPlan } from '@constants/subscriptions/planEntitlements';

const BILLING_CYCLE_OPTIONS = [
    { key: 'monthly', label: 'Mensal' },
    { key: 'quarterly', label: 'Trimestral' },
    { key: 'annual', label: 'Anual' },
] as const;

type BillingCycle = typeof BILLING_CYCLE_OPTIONS[number]['key'];

const PLAN_DISPLAY_ORDER: Record<PlanName, number> = {
    Gratuito: 0,
    Essencial: 1,
    Pro: 2,
    Elite: 3,
};

const getCatalogPlanName = (plan: Plan): PlanName => plan.canonical_name || getCanonicalPlanName(plan.name);

const planNameMatchesCycle = (plan: Plan, cycle: BillingCycle): boolean => {
    const normalizedName = String(plan.name || '').toLowerCase();

    if (cycle === 'monthly') return normalizedName.includes('mensal');
    if (cycle === 'quarterly') return normalizedName.includes('trimestral');
    return normalizedName.includes('anual');
};

const shouldReplaceVisiblePlan = (current: Plan, candidate: Plan, cycle: BillingCycle): boolean => {
    const candidateMatchesCycle = planNameMatchesCycle(candidate, cycle);
    const currentMatchesCycle = planNameMatchesCycle(current, cycle);

    if (candidateMatchesCycle !== currentMatchesCycle) {
        return candidateMatchesCycle;
    }

    return Number(candidate.id || 0) > Number(current.id || 0);
};

const PlansPage: React.FC = () => {
    const { currentUser, isLoading: isAuthLoading } = useAuth();
    const systemSettings = useAppConfigStore((state) => state.systemSettings);
    const isSystemSettingsLoaded = useAppConfigStore((state) => state.isSystemSettingsLoaded);
    const { addToast } = useToast();
    const router = useRouter();
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<number | null>(null);
    const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
    const [showDowngradeModal, setShowDowngradeModal] = useState(false);
    const [pendingDowngradePlan, setPendingDowngradePlan] = useState<Plan | null>(null);

    const loadPlans = useCallback(async () => {
        try {
            const data = await planService.getPlans();
            setPlans(data);
        } catch {
            addToast('Erro ao carregar planos', 'error');
        } finally {
            setLoading(false);
        }
    }, [addToast]);

    useEffect(() => {
        if (!isAuthLoading && !currentUser) {
            router.replace('/auth?mode=login&redirect=%2Fplans');
            return;
        }

        const timerId = window.setTimeout(() => {
            if (!isAuthLoading && currentUser) void loadPlans();
        }, 0);

        return () => window.clearTimeout(timerId);
    }, [currentUser, isAuthLoading, loadPlans, router]);

    const planDisplayNames = useMemo(() => {
        return plans.reduce<Record<number, string>>((accumulator, plan) => {
            const isCustomShortCycle = plan.interval_unit === 'day' || plan.interval_unit === 'week';
            accumulator[plan.id] = isCustomShortCycle
                ? plan.name
                : getConfiguredPlanDisplayName(plan.name, systemSettings.planDetails, plan.name);
            return accumulator;
        }, {});
    }, [plans, systemSettings.planDetails]);

    const filteredPlans = useMemo(() => {
        const visiblePlansByKey = new Map<string, Plan>();

        plans.forEach((plan) => {
            const canonicalName = getCatalogPlanName(plan);
            const price = Number(plan.price || 0);
            const cycleKey = resolvePlanCycleKey(plan);
            const isCustomShortCycle = plan.interval_unit === 'day' || plan.interval_unit === 'week';
            const isFreePlan = canonicalName === 'Gratuito' && price <= 0;

            if (!isPlanEnabledByName(canonicalName, systemSettings.planDetails)) return;
            if (canonicalName !== 'Gratuito' && price <= 0) return;

            if (isFreePlan) {
                const key = 'Gratuito:free';
                if (!visiblePlansByKey.has(key)) {
                    visiblePlansByKey.set(key, plan);
                }
                return;
            }

            if (isCustomShortCycle) {
                if (billingCycle !== 'monthly') return;

                const key = `${canonicalName}:short:${plan.id}`;
                visiblePlansByKey.set(key, plan);
                return;
            }

            if (!cycleKey || cycleKey !== billingCycle) return;

            const key = `${canonicalName}:${cycleKey}`;
            const current = visiblePlansByKey.get(key);
            if (!current || shouldReplaceVisiblePlan(current, plan, cycleKey)) {
                visiblePlansByKey.set(key, plan);
            }
        });

        const visiblePlans = Array.from(visiblePlansByKey.values());

        return visiblePlans.sort((left, right) => {
            const leftPlanOrder = PLAN_DISPLAY_ORDER[getCatalogPlanName(left)] ?? 99;
            const rightPlanOrder = PLAN_DISPLAY_ORDER[getCatalogPlanName(right)] ?? 99;
            if (leftPlanOrder !== rightPlanOrder) return leftPlanOrder - rightPlanOrder;

            const leftPrice = Number(left.price || 0);
            const rightPrice = Number(right.price || 0);
            if (leftPrice !== rightPrice) return leftPrice - rightPrice;
            return String(left.name || '').localeCompare(String(right.name || ''), 'pt-BR');
        });
    }, [billingCycle, plans, systemSettings.planDetails]);

    const autoCouponsByPlanId = useMemo(
        () => resolvePlanAutoCouponsById(filteredPlans, systemSettings.coupons || []),
        [filteredPlans, systemSettings.coupons],
    );

    const planOffersById = useMemo(() => {
        return Object.fromEntries(filteredPlans.map((plan) => [
            plan.id,
            resolvePlanOffer({
                plan,
                pricing: systemSettings.pricing,
                planDetails: systemSettings.planDetails,
                discountAmount: autoCouponsByPlanId[plan.id]?.discountAmount || 0,
            }),
        ]));
    }, [autoCouponsByPlanId, filteredPlans, systemSettings.planDetails, systemSettings.pricing]);

    const eliteDiscountBadgesByCycle = useMemo(() => (
        resolvePlanDiscountBadgesByCycle({
            plans: plans.filter((plan) => plan.is_active !== false && isPlanEnabledByName(plan.name, systemSettings.planDetails)),
            canonicalPlanName: 'Elite',
            coupons: systemSettings.coupons || [],
            pricing: systemSettings.pricing,
            planDetails: systemSettings.planDetails,
        })
    ), [plans, systemSettings.coupons, systemSettings.planDetails, systemSettings.pricing]);

    const globalProRatedCredit = useMemo(() => (
        calculateSubscriptionProRatedCredit({
            subscription: currentUser?.subscription,
            plans,
        })
    ), [currentUser?.subscription, plans]);
    const allowSameTierCycleChangeEnabled = resolveSystemFeatureFlag(systemSettings, 'sameTierCycleChangeEnabled', false);

    const handleSubscribe = async (plan: Plan) => {
        if (plan.price === 0) {
            if (!currentUser) {
                addToast('Faca login para ativar o plano gratuito', 'info');
                router.push('/auth');
            }
            return;
        }

        const activeSub = hasActivePlanAccess(currentUser);
        if (activeSub) {
            const getTier = (name: string) => {
                const normalized = name.toLowerCase();
                if (normalized.includes('elite')) return 3;
                if (normalized.includes('pro')) return 2;
                if (normalized.includes('essencial')) return 1;
                return 0;
            };
            const currentTier = getTier(currentUser?.subscription?.plan?.name || '');
            const targetTier = getTier(plan.name);

            if (currentUser?.subscription?.plan_id === plan.id) {
                addToast('Esse já é o plano ativo da sua assinatura.', 'info');
                return;
            }

            if (!allowSameTierCycleChangeEnabled && targetTier === currentTier) {
                addToast('A troca de ciclo no mesmo tier está desativada no painel admin.', 'warning');
                return;
            }

            if (targetTier < currentTier) {
                setPendingDowngradePlan(plan);
                setShowDowngradeModal(true);
                return;
            }
        }

        setProcessingId(plan.id);
        router.push(`/checkout/${plan.id}`);
    };

    if (isAuthLoading || !currentUser || loading || !isSystemSettingsLoaded) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-indigo-500" />
            </div>
        );
    }

    return (
        <div className="relative mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            <div className="relative mb-10 text-center md:mb-12">
                <Link
                    href={buildProfilePath('personal')}
                    className="mb-5 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400 transition-colors hover:text-slate-700 dark:hover:text-white md:absolute md:left-0 md:top-2 md:mb-0"
                >
                    <ArrowLeft size={16} />
                    Voltar
                </Link>
                <h1 className="mb-4 text-3xl font-bold text-slate-900 dark:text-white md:text-4xl">Escolha o seu Plano</h1>
                <p className="mx-auto mb-8 max-w-2xl text-base text-slate-600 dark:text-slate-400 md:text-lg">
                    Desbloqueie todo o potencial dos seus estudos com nossos planos premium.
                </p>

                <div className="inline-flex flex-wrap items-center justify-center gap-1 rounded-xl bg-slate-200 p-1 transition-colors dark:bg-slate-800">
                    {BILLING_CYCLE_OPTIONS.map((option) => (
                        <button
                            key={option.key}
                            onClick={() => setBillingCycle(option.key)}
                            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-all ${
                                billingCycle === option.key
                                    ? 'bg-indigo-600 text-white shadow-lg'
                                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                            }`}
                        >
                            {option.label}
                            {eliteDiscountBadgesByCycle[option.key] > 0 && (
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${
                                    billingCycle === option.key
                                        ? 'bg-white/20 text-white'
                                        : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                                }`}>
                                    {eliteDiscountBadgesByCycle[option.key]}% OFF
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            <div className="mx-auto grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                    {filteredPlans.map((plan) => {
                        const activeSub = hasActivePlanAccess(currentUser);
                        const isCurrent = currentUser?.subscription?.plan_id === plan.id && activeSub;
                        return (
                            <PlanCard
                                key={plan.id}
                                plan={plan}
                                displayName={planDisplayNames[plan.id]}
                                offer={planOffersById[plan.id]}
                                featuresOverride={getPublicPlanFeaturesForPlan(getCatalogPlanName(plan), systemSettings.planEntitlements)}
                                onSubscribe={handleSubscribe}
                                isCurrent={isCurrent}
                                isDisabled={false}
                                proRatedCredit={globalProRatedCredit}
                                isLoading={processingId === plan.id}
                            />
                        );
                    })}
            </div>

            {showDowngradeModal && pendingDowngradePlan && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/90 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
                        <div className="p-8 text-center">
                            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/10">
                                <AlertTriangle size={40} className="text-amber-500" />
                            </div>

                            <div className="space-y-4">
                                <h3 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Aviso de downgrade</h3>
                                <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                                    Ao mudar para o plano <span className="font-bold text-slate-900 dark:text-white">{planDisplayNames[pendingDowngradePlan.id] || pendingDowngradePlan.name}</span>, voce mantem o periodo pago, mas perde os beneficios premium do plano atual assim que a migracao for concluida.
                                </p>
                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-left dark:border-slate-700/50 dark:bg-slate-800/50">
                                    <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">O que muda</p>
                                    <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                                        <li className="flex items-start gap-2">
                                            <XCircle size={14} className="mt-0.5 shrink-0 text-red-500" />
                                            <span>Reducao no nivel de funcionalidades premium.</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-500" />
                                            <span>Seu credito proporcional continua aplicado no valor final.</span>
                                        </li>
                                    </ul>
                                </div>
                            </div>

                            <div className="mt-8 flex flex-col gap-3">
                                <button
                                    onClick={() => {
                                        setShowDowngradeModal(false);
                                        router.push(`/checkout/${pendingDowngradePlan.id}`);
                                    }}
                                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-4 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:bg-indigo-500 active:scale-95"
                                >
                                    Continuar com downgrade
                                    <ArrowRight size={16} />
                                </button>
                                <button
                                    onClick={() => {
                                        setShowDowngradeModal(false);
                                        setPendingDowngradePlan(null);
                                    }}
                                    className="w-full py-3 text-xs font-bold uppercase tracking-widest text-slate-500 transition-all hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PlansPage;
