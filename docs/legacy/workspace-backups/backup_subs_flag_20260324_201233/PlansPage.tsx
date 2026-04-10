
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Plan } from '../../types';
import { planService } from '../features/plans/services/planService';
import { PlanCard } from '../features/plans/components/PlanCard';
import { useToast } from '../../context/ToastContext';
import { ArrowLeft, AlertTriangle, XCircle, CheckCircle2, ArrowRight } from 'lucide-react';

export const PlansPage: React.FC = () => {
    const { currentUser } = useAuth();
    const { addToast } = useToast();
    const navigate = useNavigate();
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<number | null>(null);
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'quarterly' | 'annual'>('monthly');

    // Downgrade Logic
    const [showDowngradeModal, setShowDowngradeModal] = useState(false);
    const [pendingDowngradePlan, setPendingDowngradePlan] = useState<Plan | null>(null);

    useEffect(() => {
        loadPlans();
    }, []);

    const loadPlans = async () => {
        try {
            const data = await planService.getPlans();
            setPlans(data);
        } catch (error) {
            addToast('Erro ao carregar planos', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSubscribe = async (plan: Plan) => {
        if (plan.price === 0) {
            if (!currentUser) {
                addToast('Faça login para ativar o plano gratuito', 'info');
                navigate('/auth');
                return;
            }
            return;
        }

        const activeSub = currentUser?.subscription?.status === 'active';
        if (activeSub) {
            // Logic to check for downgrade
            const getTier = (name: string) => {
                const n = name.toLowerCase();
                if (n.includes('elite')) return 3;
                if (n.includes('pro')) return 2;
                if (n.includes('essencial')) return 1;
                return 0;
            };
            const currentTier = getTier(currentUser.subscription?.plan?.name || '');
            const targetTier = getTier(plan.name);

            if (targetTier < currentTier) {
                // It IS a downgrade
                setPendingDowngradePlan(plan);
                setShowDowngradeModal(true);
                return;
            }
        }

        // Navigate to Checkout Page
        navigate(`/checkout/${plan.id}`, { state: { from: '/plans' } });
    };

    const filteredPlans = plans.filter(plan => {
        if (plan.price === 0) return true; // Always show free plan

        const isMonthly = plan.interval_unit === 'month' && plan.interval_count === 1;
        const isQuarterly = plan.interval_unit === 'month' && plan.interval_count === 3;
        const isAnnual = plan.interval_unit === 'year' || (plan.interval_unit === 'month' && plan.interval_count === 12);

        if (billingCycle === 'monthly') return isMonthly;
        if (billingCycle === 'quarterly') return isQuarterly;
        if (billingCycle === 'annual') return isAnnual;
        return false;
    });

    if (loading) {
        return (
            <div className="flex justify-center items-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8 relative">
            <div className="text-center mb-12">
                <Link to="/profile" className="absolute left-4 top-8 text-slate-400 hover:text-white flex items-center gap-2 uppercase text-xs font-bold tracking-widest">
                    <ArrowLeft size={16} /> Voltar
                </Link>
                <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-4">Escolha o seu Plano</h1>
                <p className="text-slate-600 dark:text-slate-400 text-lg max-w-2xl mx-auto mb-8">
                    Desbloqueie todo o potencial dos seus estudos com nossos planos premium.
                </p>

                {/* Billing Cycle Toggle */}
                <div className="inline-flex bg-slate-200 dark:bg-slate-800 p-1 rounded-xl transition-colors">
                    <button
                        onClick={() => setBillingCycle('monthly')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${billingCycle === 'monthly' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                    >
                        Mensal
                    </button>
                    <button
                        onClick={() => setBillingCycle('quarterly')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${billingCycle === 'quarterly' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                    >
                        Trimestral
                    </button>
                    <button
                        onClick={() => setBillingCycle('annual')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${billingCycle === 'annual' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                    >
                        Anual
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {(() => {
                    const globalProRatedCredit = (() => {
                        if (!currentUser?.subscription || currentUser.subscription.status !== 'active') return 0;
                        const currentPlan = plans.find(p => p.id === currentUser.subscription?.plan_id);
                        if (!currentPlan || currentPlan.price <= 0) return 0;
                        if (!currentUser.subscription.current_period_start || !currentUser.subscription.current_period_end) return 0;
                        const start = new Date(currentUser.subscription.current_period_start).getTime();
                        const end = new Date(currentUser.subscription.current_period_end).getTime();
                        const now = new Date().getTime();
                        if (end > now && end > start) {
                            const totalDuration = end - start;
                            const remaining = Math.max(0, Math.min(totalDuration, end - now));
                            const credit = (currentPlan.price * remaining) / totalDuration;
                            return Math.round(Math.min(currentPlan.price, credit) * 100) / 100;
                        }
                        return 0;
                    })();

                    return filteredPlans.map((plan) => {
                        // Logic for Hierarchy
                        const getTier = (name: string) => {
                            const n = name.toLowerCase();
                            if (n.includes('elite')) return 3;
                            if (n.includes('pro')) return 2;
                            if (n.includes('essencial')) return 1;
                            return 0;
                        };

                        const getTimeScore = (p: Plan) => {
                            if (p.interval_unit === 'year') return 12;
                            if (p.interval_unit === 'month') return p.interval_count || 1;
                            return 1;
                        };

                        const activeSub = currentUser?.subscription?.status === 'active';
                        const currentPlanName = currentUser?.subscription?.plan?.name || '';
                        const currentTier = activeSub ? getTier(currentPlanName) : 0;

                        const currentPlanInList = plans.find(p => p.id === currentUser?.subscription?.plan_id);
                        const currentTimeScore = currentPlanInList ? getTimeScore(currentPlanInList) : 0;

                        const planTier = getTier(plan.name);
                        const planTimeScore = getTimeScore(plan);

                        const isCurrent = currentUser?.subscription?.plan_id === plan.id && activeSub;
                        const isLower = !isCurrent && activeSub && (
                            planTier <= currentTier && planTimeScore <= currentTimeScore
                        );

                        return (
                            <PlanCard
                                key={plan.id}
                                plan={plan}
                                onSubscribe={handleSubscribe}
                                isCurrent={isCurrent}
                                isDisabled={isLower}
                                proRatedCredit={globalProRatedCredit}
                                isLoading={processingId === plan.id}
                            />
                        );
                    });
                })()}
            </div>

            {/* Downgrade Warning Modal */}
            {showDowngradeModal && pendingDowngradePlan && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-sm animate-in fade-in transition-all">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in slide-in-from-bottom-4 duration-300">
                        <div className="p-8 text-center space-y-6">
                            <div className="w-20 h-20 bg-amber-500/10 rounded-2xl flex items-center justify-center mx-auto mb-2 border border-amber-500/20">
                                <AlertTriangle size={40} className="text-amber-500" />
                            </div>

                            <div className="space-y-4">
                                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Aviso de Downgrade</h3>
                                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                                    Ao mudar para o plano <span className="text-slate-900 dark:text-white font-bold">{pendingDowngradePlan.name}</span>, você manterá sua assinatura por um período maior, mas perderá acesso aos benefícios exclusivos do seu plano atual (<span className="text-indigo-600 dark:text-indigo-400 font-bold">{currentUser?.subscription?.plan?.name}</span>) assim que a migração for concluída.
                                </p>
                                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700/50 text-left">
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">O que muda:</p>
                                    <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-2">
                                        <li className="flex items-start gap-2">
                                            <XCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
                                            <span>Redução no nível de funcionalidades premium.</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                                            <span>Seu crédito proporcional será aplicado no novo valor.</span>
                                        </li>
                                    </ul>
                                </div>
                            </div>

                            <div className="flex flex-col gap-3 pt-4">
                                <button
                                    onClick={() => {
                                        setShowDowngradeModal(false);
                                        if (pendingDowngradePlan) {
                                            navigate(`/checkout/${pendingDowngradePlan.id}`, { state: { from: '/plans' } });
                                        }
                                    }}
                                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
                                >
                                    Continuar com Downgrade <ArrowRight size={16} />
                                </button>
                                <button
                                    onClick={() => {
                                        setShowDowngradeModal(false);
                                        setPendingDowngradePlan(null);
                                    }}
                                    className="w-full py-3 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 font-bold transition-all text-xs uppercase tracking-widest"
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
