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
import { ArrowRight, AlertTriangle, BarChart3, BookOpen, CalendarDays, Check, CheckCircle2, Clock3, Info, Star, XCircle } from 'lucide-react';
import PlatformPageHeader from '@/components/shared/layout/PlatformPageHeader';
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
    const [billingCycle, setBillingCycle] = useState<BillingCycle>('annual');
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

    const freePlan = filteredPlans.find((plan) => getCatalogPlanName(plan) === 'Gratuito');
    const elitePlan = filteredPlans.find((plan) => getCatalogPlanName(plan) === 'Elite');
    const additionalPlans = filteredPlans.filter((plan) => !['Gratuito', 'Elite'].includes(getCatalogPlanName(plan)));
    const eliteOffer = elitePlan ? planOffersById[elitePlan.id] : null;
    const eliteIsCurrent = Boolean(elitePlan && currentUser?.subscription?.plan_id === elitePlan.id && hasActivePlanAccess(currentUser));
    const eliteCycleCount = eliteOffer?.cycleCount || (elitePlan?.interval_unit === 'year'
        ? 12
        : elitePlan?.interval_unit === 'month'
            ? (elitePlan.interval_count || 1)
            : 1);
    const eliteMonthlyPrice = eliteOffer?.discountedMonthlyAmount ?? (elitePlan ? elitePlan.price / eliteCycleCount : 0);
    const eliteCyclePrice = eliteOffer?.discountedCycleAmount ?? elitePlan?.price ?? 0;
    const eliteCheckoutPrice = Math.max(0, eliteCyclePrice - (eliteIsCurrent ? 0 : globalProRatedCredit));
    const eliteMonthlyDisplayPrice = globalProRatedCredit > 0 && !eliteIsCurrent
        ? eliteCheckoutPrice / eliteCycleCount
        : eliteMonthlyPrice;
    const eliteFeatures = getPublicPlanFeaturesForPlan('Elite', systemSettings.planEntitlements, { maxItems: 8, includeDisabled: false });
    const freeFeatures = getPublicPlanFeaturesForPlan('Gratuito', systemSettings.planEntitlements, { maxItems: 6, includeDisabled: false });
    const comparisonPlans = [freePlan, ...filteredPlans.filter((plan) => getCatalogPlanName(plan) !== 'Gratuito')]
        .filter((plan): plan is Plan => Boolean(plan));
    const comparisonFeatures = Array.from(new Set(comparisonPlans.flatMap((plan) => (
        getPublicPlanFeaturesForPlan(getCatalogPlanName(plan), systemSettings.planEntitlements).map((feature) => feature.text)
    ))));
    const monthlyElitePlan = plans.find((plan) => getCatalogPlanName(plan) === 'Elite' && resolvePlanCycleKey(plan) === 'monthly');
    const monthlyEliteCoupon = monthlyElitePlan
        ? resolvePlanAutoCouponsById([monthlyElitePlan], systemSettings.coupons || [])[monthlyElitePlan.id]?.discountAmount || 0
        : 0;
    const monthlyEliteOffer = monthlyElitePlan
        ? resolvePlanOffer({
            plan: monthlyElitePlan,
            pricing: systemSettings.pricing,
            planDetails: systemSettings.planDetails,
            discountAmount: monthlyEliteCoupon,
        })
        : null;
    const annualSavings = monthlyEliteOffer && elitePlan && billingCycle === 'annual'
        ? Math.max(0, (monthlyEliteOffer.discountedCycleAmount * 12) - eliteCyclePrice)
        : 0;

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
            <PlatformPageHeader
                breadcrumbs={[{ label: 'Início', path: '/' }, { label: 'Planos', path: '/plans' }]}
                title="Planos para estudar no seu ritmo"
                description="Compare os recursos e escolha o apoio que combina com sua preparação."
                action={(
                    <p className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <CheckCircle2 size={16} className="shrink-0 text-emerald-500" />
                        Valores e descontos finais são confirmados no checkout.
                    </p>
                )}
            />

            <section aria-label="Período de assinatura" className="mb-4 flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Período de assinatura</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">O valor e a economia variam conforme o ciclo selecionado.</p>
                </div>
                <div className="inline-flex w-full rounded-md border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-950 sm:w-auto" role="group" aria-label="Ciclo de cobrança">
                    {BILLING_CYCLE_OPTIONS.map((option) => (
                        <button
                            key={option.key}
                            type="button"
                            aria-pressed={billingCycle === option.key}
                            onClick={() => setBillingCycle(option.key)}
                            className={`inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded px-2.5 text-xs font-semibold transition-colors sm:flex-none sm:px-3 ${
                                billingCycle === option.key
                                    ? 'bg-indigo-600 text-white'
                                    : 'text-slate-600 hover:bg-white hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                            }`}
                        >
                            {option.label}
                            {eliteDiscountBadgesByCycle[option.key] > 0 && (
                                <span className={`rounded px-1 py-0.5 text-[9px] font-bold ${billingCycle === option.key ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300'}`}>
                                    {eliteDiscountBadgesByCycle[option.key]}% menor
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </section>

            <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.5fr)]">
                {freePlan && (
                    <section aria-labelledby="free-plan-title" className="flex h-full flex-col rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Para começar</p>
                        <h2 id="free-plan-title" className="mt-1 text-xl font-bold text-slate-900 dark:text-white">Gratuito</h2>
                        <p className="mt-2 min-h-10 text-sm text-slate-600 dark:text-slate-400">{freePlan.description || 'Pratique questões e conheça as ferramentas essenciais da plataforma.'}</p>
                        <div className="mt-auto pt-6">
                            <p className="flex items-baseline gap-2 text-slate-900 dark:text-white">
                                <span className="text-xs font-semibold text-slate-500">R$</span>
                                <span className="text-4xl font-bold">0</span>
                                <span className="text-sm text-slate-500">/ sempre</span>
                            </p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Sem cobrança recorrente.</p>
                        </div>
                        <div className="my-4 border-t border-slate-200 dark:border-slate-800" />
                        <p className="mb-3 text-xs font-semibold text-slate-700 dark:text-slate-300">Incluído no plano</p>
                        <ul className="mb-5 space-y-2.5">
                            {freeFeatures.map((feature) => (
                                <li key={feature.text} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                                    <Check size={15} aria-hidden="true" className="mt-0.5 shrink-0 text-emerald-500" />
                                    <span>{feature.text}</span>
                                </li>
                            ))}
                        </ul>
                        <button type="button" onClick={() => router.push('/questoes')} className="min-h-10 w-full rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800">
                            Continuar no gratuito
                        </button>
                    </section>
                )}

                {elitePlan && (
                    <section aria-labelledby="elite-plan-title" className="relative flex h-full flex-col rounded-lg border-2 border-indigo-500 bg-white p-5 shadow-sm dark:bg-slate-900">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-300">Mais recursos para sua preparação</p>
                                <h2 id="elite-plan-title" className="mt-1 text-xl font-bold text-slate-900 dark:text-white">Elite</h2>
                            </div>
                            <span className="inline-flex items-center gap-1 rounded border border-indigo-300 px-2 py-1 text-[10px] font-bold uppercase text-indigo-700 dark:border-indigo-700 dark:text-indigo-300">
                                <Star size={12} aria-hidden="true" /> Plano em destaque
                            </span>
                        </div>
                        <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">{elitePlan.description || 'Um conjunto completo de ferramentas para manter consistência até o dia da prova.'}</p>

                        {eliteDiscountBadgesByCycle[billingCycle] > 0 && (
                            <p className="mt-3 inline-flex w-fit items-center gap-1.5 rounded bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                <CalendarDays size={14} aria-hidden="true" />
                                Economia de {eliteDiscountBadgesByCycle[billingCycle]}% neste ciclo
                            </p>
                        )}

                        <div className="mt-5 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-slate-900 dark:text-white">
                            <span className="text-xs font-semibold text-slate-500">R$</span>
                            <span className="text-4xl font-bold tabular-nums">{eliteMonthlyDisplayPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            <span className="text-sm text-slate-500">{billingCycle === 'monthly' ? '/ mês' : '/ mês equivalente'}</span>
                        </div>
                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                            Cobrança de <strong className="font-semibold text-slate-800 dark:text-slate-200">R$ {eliteCheckoutPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} por {billingCycle === 'annual' ? 'ano' : billingCycle === 'quarterly' ? 'trimestre' : 'mês'}</strong>.
                        </p>

                        <div className="my-4 flex flex-col gap-2 border-y border-slate-200 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
                            <p className="max-w-2xl text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                                {billingCycle === 'annual' && eliteDiscountBadgesByCycle.annual > 0
                                    ? <>O ciclo anual fica <strong className="text-slate-900 dark:text-white">{eliteDiscountBadgesByCycle.annual}% abaixo do valor mensal equivalente</strong>. Descontos ativos são confirmados no checkout.</>
                                    : <>Revise o valor, a forma de pagamento e a renovação no checkout antes de confirmar.</>}
                            </p>
                            {annualSavings > 0 && (
                                <p className="shrink-0 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                                    R$ {annualSavings.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} de economia no ano
                                </p>
                            )}
                        </div>

                        <div className="grid flex-1 gap-5 md:grid-cols-2">
                            <div>
                                <h3 className="mb-3 text-xs font-semibold text-slate-900 dark:text-white">Recursos do Elite</h3>
                                <ul className="space-y-2.5">
                                    {eliteFeatures.map((feature) => (
                                        <li key={feature.text} className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300">
                                            <Check size={14} aria-hidden="true" className="mt-0.5 shrink-0 text-emerald-500" />
                                            <span>{feature.text}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div className="border-t border-slate-200 pt-4 md:border-l md:border-t-0 md:pl-5 md:pt-0 dark:border-slate-800">
                                <h3 className="mb-3 text-xs font-semibold text-slate-900 dark:text-white">Ferramentas para seu estudo</h3>
                                <ul className="grid grid-cols-2 gap-x-3 gap-y-3 text-xs text-slate-600 dark:text-slate-300">
                                    <li><Link className="inline-flex items-center gap-2 hover:text-indigo-600 dark:hover:text-indigo-300" href="/questoes"><BookOpen size={14} aria-hidden="true" /> Banco de questões</Link></li>
                                    <li><Link className="inline-flex items-center gap-2 hover:text-indigo-600 dark:hover:text-indigo-300" href="/simulation"><Clock3 size={14} aria-hidden="true" /> Simulados</Link></li>
                                    <li><Link className="inline-flex items-center gap-2 hover:text-indigo-600 dark:hover:text-indigo-300" href="/x-ray"><BarChart3 size={14} aria-hidden="true" /> Raio-X da banca</Link></li>
                                    <li><Link className="inline-flex items-center gap-2 hover:text-indigo-600 dark:hover:text-indigo-300" href="/dashboard"><CheckCircle2 size={14} aria-hidden="true" /> Desempenho e evolução</Link></li>
                                </ul>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => void handleSubscribe(elitePlan)}
                            disabled={eliteIsCurrent || processingId === elitePlan.id}
                            className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-400 dark:disabled:bg-slate-700"
                        >
                            {eliteIsCurrent ? 'Plano atual' : processingId === elitePlan.id ? 'Processando...' : `Escolher Elite ${billingCycle === 'annual' ? 'anual' : billingCycle === 'quarterly' ? 'trimestral' : 'mensal'}`}
                            {!eliteIsCurrent && processingId !== elitePlan.id && <ArrowRight size={16} aria-hidden="true" />}
                        </button>
                        <p className="mt-2 flex items-start gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                            <Info size={13} aria-hidden="true" className="mt-0.5 shrink-0" />
                            Valor, forma de pagamento e renovação serão apresentados antes da confirmação.
                        </p>
                    </section>
                )}
            </div>

            {additionalPlans.length > 0 && (
                <section className="mt-8" aria-labelledby="additional-plans-title">
                    <h2 id="additional-plans-title" className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">Outras opções do catálogo</h2>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {additionalPlans.map((plan) => (
                            <PlanCard
                                key={plan.id}
                                plan={plan}
                                displayName={planDisplayNames[plan.id]}
                                offer={planOffersById[plan.id]}
                                featuresOverride={getPublicPlanFeaturesForPlan(getCatalogPlanName(plan), systemSettings.planEntitlements)}
                                onSubscribe={handleSubscribe}
                                isCurrent={currentUser?.subscription?.plan_id === plan.id && hasActivePlanAccess(currentUser)}
                                isDisabled={false}
                                proRatedCredit={globalProRatedCredit}
                                isLoading={processingId === plan.id}
                            />
                        ))}
                    </div>
                </section>
            )}

            <section className="mt-8" aria-labelledby="plan-comparison-title">
                <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                    <div>
                        <h2 id="plan-comparison-title" className="text-lg font-semibold text-slate-900 dark:text-white">Compare os principais recursos</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Veja o que está disponível em cada plano exibido.</p>
                    </div>
                </div>
                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                    <table className="w-full min-w-[520px] border-collapse text-left text-xs">
                        <thead className="bg-slate-50 text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                            <tr>
                                <th scope="col" className="px-3 py-3 font-semibold">Recurso</th>
                                {comparisonPlans.map((plan) => (
                                    <th key={plan.id} scope="col" className="px-3 py-3 text-center font-semibold">{planDisplayNames[plan.id] || getCatalogPlanName(plan)}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {comparisonFeatures.map((featureText) => {
                                return (
                                    <tr key={featureText} className="border-t border-slate-200 dark:border-slate-800">
                                        <th scope="row" className="px-3 py-3 font-medium text-slate-700 dark:text-slate-300">{featureText}</th>
                                        {comparisonPlans.map((plan) => {
                                            const included = getPublicPlanFeaturesForPlan(getCatalogPlanName(plan), systemSettings.planEntitlements)
                                                .some((feature) => feature.text === featureText && feature.included);
                                            return (
                                                <td key={plan.id} className={`px-3 py-3 text-center ${included ? 'font-semibold text-emerald-700 dark:text-emerald-300' : 'text-slate-600 dark:text-slate-400'}`}>
                                                    {included ? 'Incluído' : '—'}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <p className="mt-2 text-[10px] text-slate-500 dark:text-slate-400">* Recursos e limites seguem as regras vigentes da plataforma e do plano selecionado.</p>
            </section>

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
