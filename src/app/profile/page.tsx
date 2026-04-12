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

import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import ReCAPTCHA from 'react-google-recaptcha';
import {
   User, Mail, Star, Book, Settings, Shield,
   CreditCard, StickyNote, Zap, TrendingUp,
   ChevronRight, X, BarChart3, Target, Layout, 
   ShieldCheck, Bell, Info, Users, LogOut, Crown,
   Package, ExternalLink, BookOpen, Download, Trash2,
   AlertTriangle, XCircle, ArrowRight, CheckCircle2, Gift,
   Share2, Copy, Camera, Upload, AlertCircle, RotateCcw,
   Loader2, ShieldAlert, MousePointer2, Wallet
} from 'lucide-react';
import {
   AreaChart, Area, XAxis, YAxis, Tooltip,
   ResponsiveContainer
} from 'recharts';
import { useAuth } from '@providers/AuthProvider';
import { useData } from '@providers/DataProvider';
import { useToast } from '@providers/ToastProvider';
import { Subject } from '../../types';
import AuthModal from '../../components/shared/overlays/AuthModal';
import {
    readApiErrorMessage,
    buildMaterialDownloadEndpoint,
    downloadAuthenticatedFile,
} from '@services/api';
import { cardsService, formatMaskedCardLabelAscii } from '@services/billing';
import { marketplaceService } from '@services/marketplace';
import { profileService } from '@services/profile';
import { transactionsService } from '@services/transactions';
import { planService } from '@services/plans';
import {
    PLATFORM_PAGE_DESCRIPTION_CLASS,
    PLATFORM_PAGE_TITLE_CLASS,
    PLATFORM_SECTION_TITLE_CLASS,
    PLATFORM_SURFACE_CARD_CLASS,
} from '@constants/layout';
import StripeSetupCardForm from './components/StripeSetupCardForm';
import {
    formatDateInSaoPaulo,
    formatDateTimeInSaoPaulo,
    resolveProfileSubscriptionTimeline,
} from './components/subscriptionDateUtils';
import { getEffectivePlanDisplayName, hasActivePlanAccess, isPlanAtLeast } from '@services/plans/planAccess';
import { buildProfilePath, resolveProfileTab, type ProfileTab } from './profileNavigation';

type BillingCycle = 'monthly' | 'quarterly' | 'annual';

const Profile: React.FC = () => {
    const { currentUser, logout, login, refreshUser, updateUser } = useAuth();
    const { questions, userNotes, userAnswers, systemSettings } = useData();
    const { addToast } = useToast();
    const location = useLocation();
    const navigate = useNavigate();
    const params = useParams<{ tab?: string }>();
    const activeBillingProvider = (currentUser?.subscription?.payment_provider || systemSettings?.paymentProvider || 'stripe') as 'stripe';
    const isStripeBilling = activeBillingProvider === 'stripe';
    const billingProviderLabel = 'Stripe';
    const paymentCheckoutMode = (systemSettings?.paymentCheckoutMode || 'internal') as 'internal' | 'redirect';
    const cardVaultProvider = (systemSettings?.cardVaultProvider || 'stripe') as 'stripe';
    const usesInternalStripeVault = isStripeBilling;
    const stripePublishableKey = systemSettings?.stripePublishableKey || systemSettings?.stripeKey || '';
    const hasActiveSubscription = hasActivePlanAccess(currentUser);
    const effectivePlanDisplayName = getEffectivePlanDisplayName(currentUser);
    const isElitePlan = isPlanAtLeast(currentUser, 'Elite');

    const [activeTab, setActiveTab] = useState<ProfileTab>('personal');
    const [selectedCycle, setSelectedCycle] = useState<BillingCycle>('monthly');
    const [evolutionRange, setEvolutionRange] = useState<'today' | 'week' | 'month' | 'year' | 'all'>('month');
    const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
    const [showGoalModal, setShowGoalModal] = useState(false);
    const [showAuthModal, setShowAuthModal] = useState(false);

    // Novos Estados para Funcionalidades Modernas
    const [userMaterials, setUserMaterials] = useState<any[]>([]);
    const [userCards, setUserCards] = useState<any[]>([]);
    const [isLoadingCards, setIsLoadingCards] = useState(false);
    const [cardsLoadError, setCardsLoadError] = useState<string | null>(null);
    const [userTransactions, setUserTransactions] = useState<any[]>([]);
    const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
    const [referralStats, setReferralStats] = useState<any>(null);
    const [isCopying, setIsCopying] = useState(false);
    const [isAddingCard, setIsAddingCard] = useState(false);
    const [isSavingCard, setIsSavingCard] = useState(false);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [cancelReason, setCancelReason] = useState('');
    const [cancelDetails, setCancelDetails] = useState('');
    const [cancelCaptchaToken, setCancelCaptchaToken] = useState<string | null>(null);
    const [isCancelingSubscription, setIsCancelingSubscription] = useState(false);
    const [isUpdatingRenewal, setIsUpdatingRenewal] = useState(false);
    const [optimisticAutoRenew, setOptimisticAutoRenew] = useState<boolean | null>(null);
    const [isOpeningBillingPortal, setIsOpeningBillingPortal] = useState(false);
    const [stripeSetupClientSecret, setStripeSetupClientSecret] = useState<string | null>(null);
    const recaptchaEnabled = !!systemSettings?.recaptchaEnabled && !!systemSettings?.recaptchaSiteKey;
    const cancelRequestInFlightRef = React.useRef(false);
    const renewalRequestInFlightRef = React.useRef(false);

    const primarySavedCard = useMemo(() => {
        return userCards.find((card: any) => Number(card.is_default) === 1) || userCards[0] || null;
    }, [userCards]);

    const formatSavedCardLabel = React.useCallback((card: any) => {
        if (!card) return '';
        return formatMaskedCardLabelAscii(card);
    }, []);

    const getCardExpiryState = React.useCallback((card: any) => {
        if (!card?.exp_month || !card?.exp_year) {
            return { isExpired: false, isExpiringSoon: false };
        }

        const now = new Date();
        const currentMonthIndex = now.getFullYear() * 12 + now.getMonth();
        const expiryMonthIndex = (Number(card.exp_year) * 12) + (Number(card.exp_month) - 1);
        const remainingMonths = expiryMonthIndex - currentMonthIndex;

        return {
            isExpired: remainingMonths < 0,
            isExpiringSoon: remainingMonths >= 0 && remainingMonths <= 1,
        };
    }, []);

    const changeActiveTab = React.useCallback((nextTab: ProfileTab, options?: { replace?: boolean }) => {
        const resolvedTab = resolveProfileTab(nextTab);
        const nextPath = buildProfilePath(resolvedTab);

        if (location.pathname !== nextPath || location.search) {
            navigate(nextPath, { replace: options?.replace ?? false });
            return;
        }

        setActiveTab(resolvedTab);
    }, [location.pathname, location.search, navigate]);

    // Sincronizar aba com parâmetro da URL (?tab=)
    React.useEffect(() => {
        const legacyTab = new URLSearchParams(location.search).get('tab');
        const resolvedTab = resolveProfileTab(params.tab || legacyTab);
        const canonicalPath = buildProfilePath(resolvedTab);

        if (location.pathname !== canonicalPath || location.search) {
            navigate(canonicalPath, { replace: true });
            return;
        }

        setActiveTab(resolvedTab);
    }, [location.pathname, location.search, navigate, params.tab]);

    // Handlers de API para Gerenciamento de Dados
    const primarySavedCardExpiryState = useMemo(() => getCardExpiryState(primarySavedCard), [getCardExpiryState, primarySavedCard]);

    const fetchUserCards = async () => {
        if (!currentUser) return;
        setIsLoadingCards(true);
        setCardsLoadError(null);
        try {
            const res: any = await cardsService.listSavedCards();
            if (res.success) setUserCards(res.cards || []);
        } catch (err) {
            console.error('Failed to fetch cards', err);
            setCardsLoadError('Nao foi possivel sincronizar seus cartoes salvos na Stripe agora.');
        } finally {
            setIsLoadingCards(false);
        }
    };

    const handleRemoveCard = async (cardId: string) => {
        if (!window.confirm('Tem certeza que deseja remover este cartão?')) return;
        try {
            const res: any = await cardsService.removeSavedCard(cardId);
            addToast(res.message || 'Cartão removido com sucesso!', 'success');
            fetchUserCards();
        } catch (err: any) {
            addToast(readApiErrorMessage(err, 'Erro ao remover cartão.'), 'error');
        }
    };

    const handleSetDefaultCard = async (cardId: string) => {
        try {
            const res: any = await cardsService.setDefaultSavedCard(cardId);
            addToast(res.message || 'Cartão padrão atualizado!', 'success');
            fetchUserCards();
        } catch (err: any) {
            addToast(readApiErrorMessage(err, 'Erro ao definir cartão padrão.'), 'error');
        }
    };

    const handleSaveCard = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!currentUser?.id) return;
        if (isStripeBilling) {
            addToast('Use o cofre Stripe interno abaixo para salvar um novo cartão.', 'info');
            return;
        }
        
        setIsSavingCard(true);
        const formData = new FormData(e.currentTarget);
        const data = {
            user_id: currentUser.id,
            card_number: (formData.get('cardNumber') as string).replace(/\s/g, ''),
            card_name: formData.get('cardName'),
            card_expiry: formData.get('expiry'),
            brand: formData.get('brand') || 'outros'
        };

        try {
            const res: any = await cardsService.saveLegacyCard(data);
            addToast(res.message || 'Cartão salvo com sucesso!', 'success');
            setIsAddingCard(false);
            fetchUserCards();
        } catch (err: any) {
            addToast(readApiErrorMessage(err, 'Erro de rede ao salvar cartão.'), 'error');
        } finally {
            setIsSavingCard(false);
        }
    };

    const handlePrepareStripeCard = async () => {
        setIsSavingCard(true);
        try {
            const res = await cardsService.createStripeSetupIntent();
            setStripeSetupClientSecret(res.client_secret);
        } catch (err: any) {
            addToast(readApiErrorMessage(err, 'Erro ao preparar o formulário Stripe.'), 'error');
        } finally {
            setIsSavingCard(false);
        }
    };

    const handleStripeCardSaved = async (paymentMethodId: string) => {
        try {
            const res: any = await cardsService.syncStripeCard(paymentMethodId);
            addToast(res.message || 'Cartão salvo com sucesso na Stripe!', 'success');
            setStripeSetupClientSecret(null);
            setIsAddingCard(false);
            await fetchUserCards();
        } catch (err: any) {
            addToast(readApiErrorMessage(err, 'Erro ao salvar o cartão Stripe.'), 'error');
        }
    };

    const openSavedCardsManager = () => {
        changeActiveTab('personal');
        window.setTimeout(() => {
            document.getElementById('saved-cards-personal-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 120);
    };

    const handleOpenStripePortal = async () => {
        if (!currentUser?.id) return;

        setIsOpeningBillingPortal(true);
        try {
            const res: any = await planService.createStripePortalSession();
            const redirectUrl = res?.url;

            if (!redirectUrl) {
                throw new Error(res?.message || 'Não foi possível abrir o portal da Stripe.');
            }

            window.location.href = redirectUrl;
        } catch (err: any) {
            addToast(readApiErrorMessage(err, 'Erro ao abrir o portal da Stripe.'), 'error');
        } finally {
            setIsOpeningBillingPortal(false);
        }
    };

    const handleCancelSubscription = async () => {
        if (!currentUser?.id || !currentUser.subscription || cancelRequestInFlightRef.current) return;

        cancelRequestInFlightRef.current = true;
        setIsCancelingSubscription(true);

        if (recaptchaEnabled && !cancelCaptchaToken) {
            addToast('Confirme o reCAPTCHA antes de cancelar a assinatura.', 'warning');
            cancelRequestInFlightRef.current = false;
            setIsCancelingSubscription(false);
            return;
        }
        
        const start = new Date(currentUser.subscription.current_period_start).getTime();
        const now = new Date().getTime();
        const isRefundable = (now - start) < (7 * 24 * 60 * 60 * 1000);

        try {
            const res = await planService.cancelSubscription(
                currentUser.id, 
                cancelReason || (isRefundable ? 'arrependimento' : 'user_request'),
                cancelDetails || undefined,
                cancelCaptchaToken
            );
            if (res.success) {
                addToast(res.message || (isRefundable ? 'Solicitacao de cancelamento registrada.' : 'Renovacao automatica atualizada.'), 'success');
                setShowCancelModal(false);
                setCancelReason('');
                setCancelDetails('');
                setCancelCaptchaToken(null);
                await refreshUser();
                setOptimisticAutoRenew(null);
            } else {
                addToast(res.message || 'Erro ao cancelar assinatura.', 'error');
            }
        } catch (err: any) {
            addToast(readApiErrorMessage(err, 'Erro ao processar cancelamento.'), 'error');
        } finally {
            cancelRequestInFlightRef.current = false;
            setIsCancelingSubscription(false);
        }
    };

    const closeCancelModal = () => {
        if (isCancelingSubscription) return;
        setShowCancelModal(false);
        setCancelCaptchaToken(null);
    };

    const handleRenewalToggle = async () => {
        if (!currentUser?.id || !activeSubscription || isUpdatingRenewal || renewalRequestInFlightRef.current) return;

        const nextValue = !resolvedAutoRenew;
        const totalInstallments = Math.max(1, Number(activeSubscription.total_installments || 1));
        const paidInstallmentsCount = Math.max(0, Number(activeSubscription.paid_installments || 0));
        const hasRemainingCommitment = totalInstallments > 1 && paidInstallmentsCount < totalInstallments;

        if (nextValue && userCards.length === 0) {
            addToast('Você precisa de um cartão salvo para ativar a renovação automática.', 'warning');
            setIsAddingCard(true);
            openSavedCardsManager();
            return;
        }

        renewalRequestInFlightRef.current = true;
        setOptimisticAutoRenew(nextValue);
        setIsUpdatingRenewal(true);

        try {
            const res: any = await planService.updateRenewal(nextValue);
            if (res.success) {
                const confirmedAutoRenew = typeof res.data?.auto_renew === 'boolean'
                    ? res.data.auto_renew
                    : nextValue;

                setOptimisticAutoRenew(confirmedAutoRenew);
                addToast(
                    confirmedAutoRenew
                        ? 'Renovação automática ativada.'
                        : (hasRemainingCommitment
                            ? 'Renovação automática desativada. A assinatura sera encerrada ao fim do termo contratado.'
                            : 'Renovação automática desativada. A assinatura sera encerrada ao fim do período atual.'),
                    'success'
                );
                await refreshUser();
            } else {
                addToast(res.message || 'Erro ao atualizar renovação.', 'error');
                setOptimisticAutoRenew(null);
            }
        } catch (err: any) {
            addToast(readApiErrorMessage(err, 'Erro ao processar solicitacao.'), 'error');
            setOptimisticAutoRenew(null);
        } finally {
            renewalRequestInFlightRef.current = false;
            setIsUpdatingRenewal(false);
        }
    };

    const fetchUserTransactions = async () => {
        if (!currentUser?.id) return;
        setIsLoadingTransactions(true);
        try {
            const transactions = await transactionsService.list({
                userId: currentUser.id,
                limit: 50,
            });
            setUserTransactions(transactions);
        } catch (err) {
            console.error('Failed to fetch transactions', err);
            addToast('Erro ao carregar histórico de pagamentos.', 'error');
        } finally {
            setIsLoadingTransactions(false);
        }
    };

    const formatTransactionAmount = (amount: number | string) => {
        const numericAmount = typeof amount === 'number' ? amount : Number(amount || 0);
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
        }).format(numericAmount || 0);
    };

    const getTransactionStatusMeta = (status?: string) => {
        const normalized = String(status || '').toLowerCase();

        if (normalized === 'approved' || normalized === 'completed') {
            return {
                label: 'Aprovado',
                className: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400',
            };
        }

        if (normalized === 'refund_requested') {
            return {
                label: 'Reembolso em análise',
                className: 'bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400',
            };
        }

        if (normalized === 'refunded') {
            return {
                label: 'Reembolsado',
                className: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400',
            };
        }

        if (normalized === 'pending' || normalized === 'pre-approved') {
            return {
                label: normalized === 'pre-approved' ? 'Pre-aprovada' : 'Pendente',
                className: 'bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400',
            };
        }

        if (normalized === 'rejected') {
            return {
                label: 'Recusado',
                className: 'bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400',
            };
        }

        return {
            label: 'Cancelado',
            className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
        };
    };

    const formatDateBR = (value?: string | number | null) => formatDateInSaoPaulo(value);

    const legacyFormatDateTimeBR = (value?: string | number | null) => {
        if (!value) return 'Data não informada';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return 'Data não informada';
        return date.toLocaleString('pt-BR');
    };

    const formatDateTimeBR = (value?: string | number | null) => formatDateTimeInSaoPaulo(value);

    const stripPlanCycleSuffix = (value?: string | null) =>
        String(value || '')
            .replace(/\s*-\s*Mensal$/i, '')
            .replace(/\s*-\s*Trimestral$/i, '')
            .replace(/\s*-\s*Anual$/i, '')
            .trim();

    const activeSubscription = currentUser?.subscription || null;
    const serverAutoRenewState = activeSubscription
        ? (typeof activeSubscription.cancel_at_period_end === 'boolean'
            ? !activeSubscription.cancel_at_period_end
            : Boolean(activeSubscription.auto_renew))
        : false;
    const resolvedAutoRenew = optimisticAutoRenew ?? serverAutoRenewState;
    const subscriptionPlanName = stripPlanCycleSuffix(currentUser?.planDisplayName || activeSubscription?.plan?.name || effectivePlanDisplayName) || 'Plano Gratuito';
    const subscriptionTimeline = resolveProfileSubscriptionTimeline({
        billing: currentUser?.billing || null,
        subscription: activeSubscription || null,
    });
    const subscriptionCycleLabel = activeSubscription?.plan?.interval_unit === 'year'
        ? 'Anual'
        : activeSubscription?.plan?.interval_count === 3
            ? 'Trimestral'
            : 'Mensal';
    const showFreeInactiveSubscriptionState = !hasActiveSubscription && subscriptionPlanName.toLowerCase().includes('gratuito');
    const {
        termStartAt: subscriptionStartDate,
        termEndAt: subscriptionEndDate,
        totalDays: subscriptionTotalCycleDays,
        remainingDays: subscriptionRemainingDays,
        usedDays: subscriptionUsedDays,
        progressPercent: subscriptionCycleProgress,
        nextChargeAt: subscriptionNextChargeAt,
        daysSinceStart: subscriptionDaysSinceStart,
    } = subscriptionTimeline;
    const hasPendingRefundRequest = userTransactions.some((transaction: any) => String(transaction.status || '').toLowerCase() === 'refund_requested');
    const isWithinRefundWindow = subscriptionDaysSinceStart !== null
        ? subscriptionDaysSinceStart < 7
        : false;
    const installmentCount = Math.max(1, Number(activeSubscription?.total_installments || 1));
    const paidInstallments = Math.max(0, Number(activeSubscription?.paid_installments || 0));
    const currentInstallment = installmentCount > 1
        ? Math.min(Math.max(paidInstallments, 1), installmentCount)
        : 1;
    const termCommitmentRemaining = installmentCount > 1 && paidInstallments < installmentCount;
    const recurringAmount = Number(activeSubscription?.recurring_amount || 0);
    const subscriptionChargeAmount = recurringAmount > 0 ? recurringAmount : Number(activeSubscription?.plan?.price || 0);
    const nextChargeReferenceDate = subscriptionNextChargeAt || subscriptionEndDate;
    const subscriptionValueDescription = showFreeInactiveSubscriptionState
        ? 'Plano gratuito ativo.'
        : installmentCount > 1
            ? `Parcela ${currentInstallment} de ${installmentCount} do termo contratado.`
            : `Cobrança ${subscriptionCycleLabel.toLowerCase()}.`;
    const subscriptionHeadline = hasActiveSubscription
        ? (resolvedAutoRenew
            ? `A renovação automática está ligada e a próxima cobrança está prevista para ${formatDateBR(nextChargeReferenceDate)}.`
            : (termCommitmentRemaining
                ? 'A renovação automática está desligada. O termo atual seguirá até a última parcela contratada e depois será encerrado.'
                : `A renovação automática está desligada. Seu acesso fica ativo até ${formatDateBR(subscriptionEndDate)}.`))
        : 'Sua assinatura não está ativa no momento.';
    const legacySubscriptionValueDescription = showFreeInactiveSubscriptionState
        ? 'Plano gratuito ativo.'
        : installmentCount > 1
            ? `Cobrança ${paidInstallments > 0 ? `da parcela ${Math.min(paidInstallments, installmentCount)} de ${installmentCount}` : 'mensal do termo contratado'}.`
            : `Cobrança ${subscriptionCycleLabel.toLowerCase()}.`;
    const legacySubscriptionHeadline = hasActiveSubscription
        ? (resolvedAutoRenew
            ? `A renovação automática esta ligada e a proxima cobrança esta prevista para ${formatDateBR(activeSubscription?.current_period_end)}.`
            : (termCommitmentRemaining
                ? 'A renovação automática esta desligada. O termo atual seguira ate a ultima parcela contratada e depois sera encerrado.'
                : `A renovação automática esta desligada. Seu acesso fica ativo ate ${formatDateBR(activeSubscription?.current_period_end)}.`))
        : 'Sua assinatura não esta ativa no momento.';
    const renewalCardDescription = hasActiveSubscription
        ? (resolvedAutoRenew
            ? 'Sua assinatura segue protegida para renovar automaticamente ao fim deste ciclo.'
            : (termCommitmentRemaining
                ? 'A renovação esta desligada. As cobrancas atuais seguem ate o fim do termo contratado e depois param automaticamente.'
                : 'A renovação esta desligada e o acesso termina no fim deste ciclo.'))
        : 'Ative um plano pago para controlar a renovação automática por aqui.';
    const normalizedSubscriptionStatus = String(activeSubscription?.status || '').toLowerCase();
    const hasSubscriptionRecord = Boolean(activeSubscription?.id);
    const hasScheduledCancellation = Boolean(activeSubscription?.cancel_at_period_end);
    const isCanceledStatus = normalizedSubscriptionStatus === 'canceled' || normalizedSubscriptionStatus === 'cancelled';
    const isCanceledButStillActive = hasActiveSubscription && (hasScheduledCancellation || isCanceledStatus);
    const renewalStateLabel = !hasSubscriptionRecord || !hasActiveSubscription
        ? 'Inexistente'
        : resolvedAutoRenew
            ? 'Ativada'
            : 'Desativada';
    const renewalStateClassName = renewalStateLabel === 'Ativada'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
        : renewalStateLabel === 'Desativada'
            ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300'
            : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300';
    const cancellationImpactMessage = hasActiveSubscription
        ? (termCommitmentRemaining
            ? 'Ao cancelar, o acesso continua ate o fim do termo contratado.'
            : `Ao cancelar, o acesso continua ate ${formatDateBR(subscriptionEndDate)}.`)
        : 'Sem assinatura ativa para cancelamento.';
    const billingStatusLabel = currentUser?.paymentIssue
        ? 'Atencao no pagamento'
        : hasActiveSubscription
            ? 'Cobranca em dia'
            : 'Sem cobranca ativa';

    React.useEffect(() => {
        setOptimisticAutoRenew(null);
    }, [activeSubscription?.id, activeSubscription?.auto_renew, activeSubscription?.cancel_at_period_end]);

    const fetchUserMaterials = async () => {
        if (!currentUser?.id) return;
        try {
            const materials = await marketplaceService.listUserMaterials(currentUser.id);
            setUserMaterials(materials);
        } catch (err) {
            console.error('Error fetching materials:', err);
        }
    };

    const fetchReferralStats = async () => {
        try {
            const stats = await profileService.getReferralStats();
            setReferralStats(stats);
        } catch (err) {
            console.error('Failed to fetch referral stats', err);
        }
    };

    const handleCancelRefundRequest = async () => {
        if (!currentUser?.id) return;
        if (!window.confirm('Deseja realmente cancelar sua solicitacao de reembolso?')) return;

        try {
            const res: any = await planService.cancelRefundRequest();
            addToast(res.message || 'Solicitacao cancelada com sucesso.', 'success');
            await refreshUser();
            await fetchUserTransactions();
        } catch (err: any) {
            addToast(readApiErrorMessage(err, 'Erro ao cancelar solicitacao.'), 'error');
        }
    };

    const renderBillingTab = () => (
        <div className="space-y-5">
            {currentUser?.paymentIssue && (
                <div className={`rounded-[1.5rem] border px-4 py-4 ${currentUser.paymentIssue.type === 'expiring_card' ? 'border-amber-200 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/10' : 'border-rose-200 bg-rose-50 dark:border-rose-500/20 dark:bg-rose-500/10'}`}>
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-start gap-3">
                            <div className={`mt-0.5 rounded-2xl p-2.5 text-white shadow-lg ${currentUser.paymentIssue.type === 'expiring_card' ? 'bg-amber-500 shadow-amber-500/20' : 'bg-rose-500 shadow-rose-500/20'}`}>
                                <ShieldAlert size={16} />
                            </div>
                            <div className="space-y-1">
                                <p className={`text-[9px] font-black uppercase tracking-[0.18em] ${currentUser.paymentIssue.type === 'expiring_card' ? 'text-amber-700 dark:text-amber-300' : 'text-rose-600 dark:text-rose-300'}`}>Atencao no pagamento</p>
                                <p className="text-xs font-semibold leading-5 text-slate-700 dark:text-slate-200">
                                    {currentUser.paymentIssue.message || 'Atualize sua forma de pagamento para evitar interrupcoes no acesso.'}
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={openSavedCardsManager}
                            className="h-10 rounded-xl bg-slate-900 px-4 text-[9px] font-black uppercase tracking-[0.18em] text-white transition-all hover:bg-slate-800 dark:bg-rose-500 dark:text-slate-950"
                        >
                            Resolver
                        </button>
                    </div>
                </div>
            )}

            <section className={`overflow-hidden ${PLATFORM_SURFACE_CARD_CLASS}`}>
                <div className="border-b border-slate-100 px-5 py-6 dark:border-slate-800 md:px-6 md:py-6">
                    <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                        <div className="max-w-2xl space-y-3">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Assinatura</p>
                            <h2 className={PLATFORM_PAGE_TITLE_CLASS}>
                                {showFreeInactiveSubscriptionState ? 'Plano Gratuito' : subscriptionPlanName}
                            </h2>
                            <p className={PLATFORM_PAGE_DESCRIPTION_CLASS}>
                                {subscriptionHeadline}
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-2 md:max-w-[320px] md:justify-end">
                            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.16em] text-slate-500 dark:border-slate-700 dark:text-slate-300">
                                <span className={`h-2 w-2 rounded-full ${hasActiveSubscription ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
                                {hasActiveSubscription ? 'Assinatura ativa' : 'Assinatura'}
                            </span>
                            <span className={`inline-flex items-center rounded-full border px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.16em] ${hasActiveSubscription ? 'border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300' : 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>
                                {hasActiveSubscription ? 'Ativa' : 'Inativa'}
                            </span>
                            {hasActiveSubscription && (
                                <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.16em] text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                    {subscriptionCycleLabel}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="space-y-4 px-5 py-5 md:px-6 md:py-6">
                    <div className="grid gap-3 md:grid-cols-3">
                        <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-800/40">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Status</p>
                            <p className="mt-2 text-lg font-black leading-tight text-slate-900 dark:text-slate-100">
                                {hasPendingRefundRequest ? 'Reembolso em análise' : hasActiveSubscription ? 'Acesso liberado' : 'Assinatura inativa'}
                            </p>
                            <p className="mt-2 text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">
                                {hasPendingRefundRequest
                                    ? 'Sua solicitacao esta em andamento e atualizaremos o histórico assim que houver retorno do gateway.'
                                    : hasActiveSubscription
                                        ? 'Seu acesso premium esta liberado e o ciclo atual segue normalmente.'
                                        : 'Sua assinatura não esta ativa no momento.'}
                            </p>
                        </div>

                        <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-800/40">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Fim do ciclo</p>
                            <p className="mt-2 text-lg font-black leading-tight text-slate-900 dark:text-slate-100">
                                {hasActiveSubscription ? formatDateBR(subscriptionEndDate) : 'Indeterminado'}
                            </p>
                            <p className="mt-2 text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">
                                {hasActiveSubscription ? 'Período atual da assinatura.' : 'Sem ciclo de cobrança em andamento.'}
                            </p>
                        </div>

                        <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-800/40">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Valor</p>
                            <p className="mt-2 text-lg font-black leading-tight text-slate-900 dark:text-slate-100">
                                {showFreeInactiveSubscriptionState ? '0,00' : formatTransactionAmount(subscriptionChargeAmount)}
                            </p>
                            <p className="mt-2 text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">
                                {subscriptionValueDescription}
                            </p>
                        </div>
                    </div>

                    {!showFreeInactiveSubscriptionState && activeSubscription && (
                        <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-800/40 md:px-5 md:py-5">
                            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Progresso do ciclo</p>
                                    <p className="text-lg font-black leading-tight text-slate-900 dark:text-slate-100">
                                        {subscriptionUsedDays} de {subscriptionTotalCycleDays || 30} dias utilizados
                                    </p>
                                    <p className="text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">
                                        Um resumo rapido do ciclo atual.
                                    </p>
                                </div>

                                <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-indigo-600 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300">
                                    {subscriptionRemainingDays} dias restantes
                                </span>
                            </div>

                            <div className="mt-6 space-y-3">
                                <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                                    <span>{subscriptionUsedDays} dias usados</span>
                                    <span>{subscriptionRemainingDays} dias restantes</span>
                                </div>
                                <div className="h-3 rounded-full bg-slate-200 dark:bg-slate-800">
                                    <div
                                        className="h-3 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all"
                                        style={{ width: `${subscriptionCycleProgress}%` }}
                                    />
                                </div>
                                <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
                                    <span>Início: {formatDateBR(subscriptionStartDate)}</span>
                                    <span>Fim: {formatDateBR(subscriptionEndDate)}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </section>

            <div className="grid gap-4 md:grid-cols-2">
                {!showFreeInactiveSubscriptionState && hasActiveSubscription && (
                    <>
                        <div className={`${PLATFORM_SURFACE_CARD_CLASS} px-4 py-4 md:px-5 md:py-4`}>
                            <div className="flex items-start justify-between gap-4">
                                <div className="space-y-2.5">
                                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Renovacao</p>
                                    <h3 className="text-base font-black leading-tight text-slate-900 dark:text-slate-100">Renovacao automatica</h3>
                                    <p className="text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">
                                        {renewalCardDescription}
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={handleRenewalToggle}
                                    disabled={!hasActiveSubscription || isUpdatingRenewal}
                                    role="switch"
                                    aria-checked={resolvedAutoRenew}
                                    aria-label={resolvedAutoRenew ? 'Desativar renovacao automatica' : 'Ativar renovacao automatica'}
                                    className={`relative inline-flex h-7 w-12 items-center rounded-full border transition-all ${resolvedAutoRenew ? 'border-emerald-500 bg-emerald-500/90' : 'border-slate-200 bg-slate-200 dark:border-slate-700 dark:bg-slate-800'} ${(!hasActiveSubscription || isUpdatingRenewal) ? 'cursor-not-allowed opacity-60' : 'hover:scale-[1.02] active:scale-[0.98]'}`}
                                >
                                    <span className={`inline-flex h-5 w-5 transform items-center justify-center rounded-full bg-white shadow transition-transform ${resolvedAutoRenew ? 'translate-x-6' : 'translate-x-1'}`}>
                                        {isUpdatingRenewal ? <Loader2 size={11} className="animate-spin text-slate-400" /> : null}
                                    </span>
                                </button>
                            </div>
                        </div>

                        <div className={`${PLATFORM_SURFACE_CARD_CLASS} px-4 py-4 md:px-5 md:py-4`}>
                            <div className="space-y-3">
                                <div className="space-y-2.5">
                                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Cancelamento</p>
                                    <h3 className="text-base font-black leading-tight text-slate-900 dark:text-slate-100">
                                        {isWithinRefundWindow ? 'Janela de reembolso aberta' : 'Gerenciar cancelamento'}
                                    </h3>
                                    <p className="text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">
                                        {isWithinRefundWindow
                                            ? 'Voce ainda esta dentro dos 7 dias para cancelar a assinatura com reembolso.'
                                            : 'Se decidir encerrar a assinatura, o acesso segue ate o fim do ciclo atual.'}
                                    </p>
                                </div>

                                {hasPendingRefundRequest ? (
                                    <div className="flex flex-wrap items-center gap-3">
                                        <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.14em] text-amber-600 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                                            Reembolso em analise
                                        </span>
                                        <button
                                            type="button"
                                            onClick={handleCancelRefundRequest}
                                            className="h-10 rounded-xl border border-slate-200 px-4 text-[9px] font-black uppercase tracking-[0.14em] text-slate-600 transition-all hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                                        >
                                            Cancelar solicitacao
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => setShowCancelModal(true)}
                                        disabled={!hasActiveSubscription}
                                        className="h-10 rounded-xl bg-rose-600 px-4 text-[9px] font-black uppercase tracking-[0.14em] text-white transition-all hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        Cancelar assinatura
                                    </button>
                                )}
                            </div>
                        </div>
                    </>
                )}

                <div className={`${PLATFORM_SURFACE_CARD_CLASS} px-4 py-4 md:px-5 md:py-4`}>
                    <div className="flex items-start justify-between gap-4">
                        <div className="space-y-2.5">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Pagamento</p>
                            <h3 className="text-base font-black leading-tight text-slate-900 dark:text-slate-100">Cartoes e cobranca</h3>
                            <p className="text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">
                                Os cartoes salvos ficam em Dados pessoais para compras futuras e renovacoes.
                            </p>
                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                                Provedor atual: {billingProviderLabel}
                            </p>
                        </div>

                        <div className="rounded-[1.1rem] bg-slate-50 px-4 py-2.5 text-right dark:bg-slate-800">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Cartoes</p>
                            <p className="mt-1.5 text-xl font-black leading-none text-slate-900 dark:text-slate-100">{cardsLoadError ? '--' : userCards.length}</p>
                        </div>
                    </div>

                    {cardsLoadError ? (
                        <div className="mt-4 rounded-[1.2rem] border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-500/20 dark:bg-amber-500/10">
                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">Sincronizacao Stripe</p>
                            <p className="mt-1 text-xs font-medium leading-5 text-slate-600 dark:text-slate-300">
                                {cardsLoadError}
                            </p>
                        </div>
                    ) : primarySavedCard ? (
                        <div className="mt-4 rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/40">
                            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">Cartao principal na Stripe</p>
                                    <p className="mt-1 text-sm font-black text-slate-900 dark:text-slate-100">{formatSavedCardLabel(primarySavedCard)}</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                                        Expira em {String(primarySavedCard.exp_month || '').padStart(2, '0')}/{primarySavedCard.exp_year}
                                    </span>
                                    <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-indigo-600 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300">
                                        Stripe
                                    </span>
                                    {primarySavedCardExpiryState.isExpired && (
                                        <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
                                            Expirado
                                        </span>
                                    )}
                                    {!primarySavedCardExpiryState.isExpired && primarySavedCardExpiryState.isExpiringSoon && (
                                        <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                                            Vence em breve
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : null}

                    <div className="mt-4">
                        <button
                            type="button"
                            onClick={openSavedCardsManager}
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-[9px] font-black uppercase tracking-[0.14em] text-white transition-all hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900"
                        >
                            <CreditCard size={14} />
                            Gerenciar cartoes
                        </button>
                    </div>
                </div>

                <div className="rounded-[1.7rem] border border-indigo-200 bg-gradient-to-r from-indigo-600 via-indigo-600 to-violet-600 px-4 py-4 text-white shadow-xl shadow-indigo-200 dark:border-indigo-500/20 dark:shadow-none md:px-5 md:py-5">
                    <div className="space-y-3.5">
                        <div className="space-y-2.5">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-100">Upgrade</p>
                            <h3 className="text-lg font-black leading-tight">
                                {isElitePlan ? 'Seu plano ja esta no nivel maximo' : 'Veja outros planos'}
                            </h3>
                            <p className="text-xs font-medium leading-5 text-indigo-100/90">
                                {isElitePlan
                                    ? 'Compare beneficios e avalie se quer manter seu plano atual ou revisar outros ciclos.'
                                    : 'Compare ciclos e beneficios antes de trocar o seu plano atual.'}
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={() => navigate('/plans')}
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-white px-4 text-[9px] font-black uppercase tracking-[0.14em] text-indigo-600 transition-all hover:bg-slate-100"
                        >
                            Ver planos
                            <ChevronRight size={14} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderBillingHistoryTab = () => (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div className="space-y-1">
                    <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400 dark:text-slate-500">Histórico</p>
                    <h2 className="text-2xl font-black leading-none text-slate-900 dark:text-slate-100">Transações</h2>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                        Acompanhe cobrancas aprovadas, parcelas futuras pre-aprovadas e faturas emitidas pelo gateway.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={fetchUserTransactions}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 transition-all hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                    <RotateCcw size={14} />
                    Atualizar
                </button>
            </div>

            <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                {isLoadingTransactions ? (
                    <div className="flex items-center justify-center px-6 py-20">
                        <Loader2 size={28} className="animate-spin text-indigo-500" />
                    </div>
                ) : userTransactions.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-left">
                            <thead>
                                <tr className="border-b border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50">
                                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">ID do gateway</th>
                                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Plano</th>
                                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Data / hora</th>
                                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Status</th>
                                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 text-right">Valor</th>
                                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 text-center">Fatura</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {userTransactions.map((tx: any) => {
                                    const statusMeta = getTransactionStatusMeta(tx.status);
                                    const referenceId = tx.providerTransactionId || tx.referenceId || tx.id;
                                    const referenceLabel = tx.providerTransactionLabel || 'ID Stripe';
                                    const invoiceUrl = tx.invoicePdfUrl || tx.hostedInvoiceUrl || null;
                                    const installmentLabel = tx.installmentCount > 1 ? `Parcela ${tx.installmentNumber || 1}/${tx.installmentCount}` : null;

                                    return (
                                        <tr key={tx.id} className="align-top transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/30">
                                            <td className="px-5 py-4">
                                                <div className="space-y-2">
                                                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">{referenceLabel}</p>
                                                    <div className="flex items-center gap-2">
                                                        <code className="max-w-[180px] truncate text-xs font-black text-slate-900 dark:text-slate-100">{referenceId || '-'}</code>
                                                        {referenceId && (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    navigator.clipboard.writeText(String(referenceId));
                                                                    addToast('ID copiado.', 'success');
                                                                }}
                                                                className="rounded-lg border border-slate-200 px-2 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-slate-500 transition-all hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                                            >
                                                                Copiar
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="space-y-2">
                                                    <p className="text-sm font-black leading-[1.2] text-slate-900 dark:text-slate-100">
                                                        {tx.planName || tx.transactionName || tx.description || 'Assinatura'}
                                                    </p>
                                                    <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                                                        <span>Stripe</span>
                                                        <span>?</span>
                                                        <span>{tx.paymentMethodLabel || 'Cartão'}</span>
                                                        {installmentLabel && (
                                                            <>
                                                                <span>?</span>
                                                                <span>{installmentLabel}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="space-y-1">
                                                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                                        {tx.dateTimeFormatted || formatDateTimeBR(tx.createdAt || tx.dueDate || tx.timestamp)}
                                                    </p>
                                                    {tx.scheduleLabel && (
                                                        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                                            {tx.scheduleLabel}
                                                        </p>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="space-y-2">
                                                    <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${statusMeta.className}`}>
                                                        {statusMeta.label}
                                                    </span>
                                                    {tx.providerRefundId && (
                                                        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                                            Refund: {tx.providerRefundId}
                                                        </p>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 text-right">
                                                <p className="text-sm font-black text-slate-900 dark:text-slate-100">
                                                    {formatTransactionAmount(tx.amount)}
                                                </p>
                                            </td>
                                            <td className="px-5 py-4 text-center">
                                                {invoiceUrl ? (
                                                    <a
                                                        href={invoiceUrl}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-600 transition-all hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                                                    >
                                                        <Download size={14} />
                                                        PDF
                                                    </a>
                                                ) : (
                                                    <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">-</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="px-6 py-20 text-center">
                        <BarChart3 size={32} className="mx-auto mb-4 text-slate-300 dark:text-slate-700" />
                        <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Nenhuma transação registrada ainda.</p>
                    </div>
                )}
            </div>
        </div>
    );

    const renderCancelSubscriptionModal = () => {
        if (!showCancelModal || !activeSubscription) return null;

        return createPortal(
            <AnimatePresence>
                <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={closeCancelModal}
                        className="fixed inset-0 bg-slate-900/90 backdrop-blur-md"
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative z-10 w-full max-w-lg overflow-hidden rounded-3xl border border-rose-100 bg-white shadow-2xl dark:border-rose-900/20 dark:bg-slate-900"
                    >
                        <button
                            type="button"
                            onClick={closeCancelModal}
                            disabled={isCancelingSubscription}
                            className="absolute right-5 top-5 rounded-2xl border border-slate-200 bg-white/90 p-2 text-slate-400 transition-all hover:border-slate-300 hover:text-slate-600 dark:border-slate-700 dark:bg-slate-900/80 dark:hover:text-slate-200"
                        >
                            <X size={18} />
                        </button>

                        <div className="p-8 text-center">
                            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full border-2 border-rose-100 bg-rose-50 dark:border-rose-500/20 dark:bg-rose-500/10">
                                <ShieldAlert size={38} className="text-rose-600 dark:text-rose-500" />
                            </div>

                            <div className="space-y-3">
                                <h3 className="text-2xl font-black italic text-slate-900 dark:text-slate-100">
                                    Já vai nos deixar, {currentUser?.name?.split(' ')[0] || 'aluno'}?
                                </h3>
                                <p className="mx-auto max-w-md text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                                    {isWithinRefundWindow
                                        ? 'Você ainda esta no período de garantia. Se cancelar agora, o reembolso pode ser solicitado e seu acesso sera encerrado com segurança.'
                                        : 'Sua aprovação esta cada dia mais proxima. Cancelando agora, a renovação automática sera desligada e o acesso seguira somente ate o fim do ciclo vigente.'}
                                </p>
                            </div>

                            {isWithinRefundWindow && (
                                <div className="mt-6 flex items-start gap-4 rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-left dark:border-indigo-500/10 dark:bg-indigo-500/5">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-500/20">
                                        <ShieldCheck size={18} />
                                    </div>
                                    <div className="space-y-1">
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">Garantia legal de 7 dias</h4>
                                        <p className="text-[11px] font-medium leading-tight text-indigo-900/70 dark:text-indigo-300/70">
                                            Sua satisfacao e prioridade. Cancelando dentro desse prazo, o sistema trata a solicitacao de reembolso com os dados da Stripe.
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="mt-6 space-y-4 rounded-2xl border border-slate-100 bg-slate-50 p-6 text-left dark:border-slate-800 dark:bg-slate-800/50">
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                                        Motivo principal (opcional)
                                    </label>
                                    <select
                                        value={cancelReason}
                                        onChange={(e) => setCancelReason(e.target.value)}
                                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-900 outline-none transition-all focus:ring-2 focus:ring-rose-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                    >
                                        <option value="">Selecione uma opcao...</option>
                                        <option value="price">Valor da assinatura</option>
                                        <option value="usage">Não estou usando o suficiente</option>
                                        <option value="technical">Problemas técnicos</option>
                                        <option value="content">Falta de conteúdos especificos</option>
                                        <option value="other">Outros motivos</option>
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                                        Detalhes adicionais (opcional)
                                    </label>
                                    <textarea
                                        value={cancelDetails}
                                        onChange={(event) => setCancelDetails(event.target.value)}
                                        rows={4}
                                        placeholder="Se quiser, conte rapidamente o que motivou o cancelamento."
                                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-rose-400 focus:ring-2 focus:ring-rose-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                                    />
                                </div>

                                {recaptchaEnabled ? (
                                    <div className="space-y-2 rounded-2xl border border-slate-200 bg-white px-4 py-4 dark:border-slate-700 dark:bg-slate-900">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                                            Confirmacao de segurança
                                        </p>
                                        <div className="flex justify-center">
                                            <ReCAPTCHA
                                                sitekey={systemSettings?.recaptchaSiteKey || ''}
                                                onChange={setCancelCaptchaToken}
                                                theme={document.documentElement.classList.contains('dark') ? 'dark' : 'light'}
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-[11px] font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                                        A confirmacao por reCAPTCHA esta desativada nas configurações da plataforma.
                                    </p>
                                )}
                            </div>

                            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <button
                                    type="button"
                                    onClick={closeCancelModal}
                                    disabled={isCancelingSubscription}
                                    className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-indigo-600 text-xs font-black uppercase tracking-widest text-white shadow-xl shadow-indigo-500/20 transition-all hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    <Zap size={18} className="fill-current" />
                                    Manter acesso VIP
                                </button>
                                <button
                                    type="button"
                                    onClick={handleCancelSubscription}
                                    disabled={isCancelingSubscription || (recaptchaEnabled && !cancelCaptchaToken)}
                                    className="flex h-14 items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 bg-transparent text-[10px] font-black uppercase tracking-widest text-slate-400 transition-all hover:border-rose-500/30 hover:text-rose-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800"
                                >
                                    {isCancelingSubscription ? <Loader2 size={16} className="animate-spin" /> : null}
                                    {isCancelingSubscription ? 'Processando...' : 'Confirmar cancelamento'}
                                </button>
                            </div>

                            <p className="mt-4 text-[9px] font-black uppercase tracking-tight text-slate-400">
                                Você mantera seu acesso ate o dia {formatDateBR(currentUser?.subscription?.current_period_end)}
                            </p>
                        </div>
                    </motion.div>
                </div>
            </AnimatePresence>,
            document.body
        );
    };

    // Atualizar dados quando a aba mudar
    React.useEffect(() => {
        if (activeTab === 'billing' || activeTab === 'personal') fetchUserCards();
        if (activeTab === 'billing' || activeTab === 'billing-history') fetchUserTransactions();
        if (activeTab === 'materials') fetchUserMaterials();
        if (activeTab === 'referral') fetchReferralStats();
    }, [activeTab, isStripeBilling]);

   const EXAM_AREAS = [
      { group: 'Carreiras', areas: ['Policial', 'Fiscal', 'Tribunais', 'Jurídico', 'Educação', 'Militar', 'Saúde', 'TI', 'Diplomata'] },
      { group: 'Exames', areas: ['Residência em Saúde', 'CFC - Exame de Suficiência', 'OAB - Exame de Ordem'] }
   ];

   const timelineData = useMemo(() => {
      const data: Record<string, { date: string, taxa: number, total: number }> = {};
      const now = new Date();
      let steps = 30;
      let format: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit' };

      if (evolutionRange === 'today') {
         steps = now.getHours() + 1;
         format = { hour: '2-digit', minute: '2-digit' };
      } else if (evolutionRange === 'year') {
         steps = 12;
         format = { month: 'short' };
      } else if (evolutionRange === 'week') {
         steps = 7;
      }

      for (let i = steps - 1; i >= 0; i--) {
         const d = new Date(now);
         if (evolutionRange === 'today') d.setHours(d.getHours() - i, 0, 0, 0);
         else if (evolutionRange === 'year') { d.setMonth(d.getMonth() - i, 1); d.setHours(0, 0, 0, 0); }
         else { d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0); }

         const label = evolutionRange === 'today'
            ? `${d.getHours().toString().padStart(2, '0')}:00`
            : d.toLocaleDateString('pt-BR', format);

         data[label] = { date: label, taxa: 0, total: 0 };
      }

      userAnswers.forEach(ans => {
         const d = new Date(ans.timestamp);
         const label = evolutionRange === 'today' ? `${d.getHours().toString().padStart(2, '0')}:00` : d.toLocaleDateString('pt-BR', format);
         if (data[label]) {
            const periodEntries = userAnswers.filter(a => {
               const ad = new Date(a.timestamp);
               const al = evolutionRange === 'today' ? `${ad.getHours().toString().padStart(2, '0')}:00` : ad.toLocaleDateString('pt-BR', format);
               return al === label;
            });
            const correct = periodEntries.filter(a => a.isCorrect).length;
            data[label].taxa = Math.round((correct / periodEntries.length) * 100);
            data[label].total = periodEntries.length;
         }
      });
      return Object.values(data);
   }, [userAnswers, evolutionRange]);


   const generalStats = useMemo(() => {
      const total = userAnswers.length;
      const correct = userAnswers.filter(a => a.isCorrect).length;
      const wrong = total - correct;
      const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;

      const diffStats = {
         'Fácil': { total: 0, correct: 0 },
         'Médio': { total: 0, correct: 0 },
         'Difícil': { total: 0, correct: 0 }
      };

      userAnswers.forEach(ans => {
         const q = questions.find(item => item.id === ans.questionId);
         if (q) {
            const label = q.difficulty === 'Fácil' ? 'Fácil' : q.difficulty === 'Médio' ? 'Médio' : 'Difícil';
            if (diffStats[label as keyof typeof diffStats]) {
               diffStats[label as keyof typeof diffStats].total++;
               if (ans.isCorrect) diffStats[label as keyof typeof diffStats].correct++;
            }
         }
      });

      // Topics progress
      const uniqueTopics = new Set(userAnswers.map(ans => questions.find(q => q.id === ans.questionId)?.topic).filter(Boolean));
      const allPossibleTopics = new Set(questions.map(q => q.topic).filter(Boolean));
      const topicsProgress = allPossibleTopics.size > 0 ? Math.round((uniqueTopics.size / allPossibleTopics.size) * 100) : 0;

      return { total, correct, wrong, accuracy, xp: total * 10, diffStats, topicsProgress };
   }, [userAnswers, questions]);

   if (!currentUser) {
      return (
         <div className="max-w-xl mx-auto pt-20 pb-20 px-6 text-center animate-fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-10 shadow-xl border border-slate-200 dark:border-slate-800 relative overflow-hidden">
               <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
               <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300 dark:text-slate-600">
                  <User size={40} />
               </div>
               <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 mb-3">Identifique-se</h2>
               <p className="text-slate-500 dark:text-slate-400 font-medium mb-8 leading-relaxed">
                  Faça login para acompanhar seu desempenho, gerenciar sua assinatura e salvar seu progresso.
               </p>
               <button
                  onClick={() => setShowAuthModal(true)}
                  className="w-full py-4 bg-slate-900 dark:bg-indigo-600 text-white rounded-xl font-bold uppercase tracking-widest hover:bg-indigo-600 dark:hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none"
               >
                  Entrar ou Criar Conta
               </button>
            </div>
            <AuthModal
               isOpen={showAuthModal}
               onClose={() => setShowAuthModal(false)}
               title="Acesse seu Perfil"
               description="Gerencie seus dados e acompanhe sua evolução detalhada."
            />
         </div>
      );
   }

    const SidebarItem = ({ id, label, icon: Icon }: any) => (
        <button
            onClick={() => {
                changeActiveTab(id, { replace: true });
            }}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-bold transition-all ${activeTab === id ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/30 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'}`}
        >
            <div className="flex items-center gap-3"><Icon size={16} /> {label}</div>
            {activeTab === id && <ChevronRight size={14} className="text-indigo-400 dark:text-indigo-500" />}
        </button>
    );

    return (
        <div className="max-w-6xl mx-auto pb-20 space-y-6">
            <header>
                <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2 transition-colors">
                    <User className="text-indigo-600 dark:text-indigo-400" /> Meu Perfil
                </h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mt-1 transition-colors">Gerencie seus dados, assinatura e acompanhe sua evolução.</p>
            </header>

            {/* Banner: Conteúdo Incompleto */}
            {currentUser && (!currentUser.cpf || !currentUser.address?.zipCode) && (
                <div className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-6 py-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg border border-indigo-400/30">
                    <div className="flex items-center gap-4">
                        <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                            <User size={24} className="text-white" />
                        </div>
                        <div>
                            <h4 className="font-bold text-sm">Complete seu cadastro para facilitar suas compras</h4>
                            <p className="text-xs text-indigo-100 mt-0.5">Adicione seu CPF e endereço para agilizar o checkout de materiais e planos.</p>
                        </div>
                    </div>
                    <button onClick={() => changeActiveTab('personal')} className="px-4 py-2 bg-white text-indigo-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-50 transition-all flex items-center gap-2 shrink-0 active:scale-95">
                        Completar Agora <ArrowRight size={14} />
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* SIDEBAR DE NAVEGAÇÃO */}
                <aside className="lg:col-span-3 space-y-6">
                    {/* Cartão do Usuário */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col items-center text-center space-y-3 transition-colors">
                        <div 
                            className="relative group cursor-pointer"
                            onClick={() => {
                                const input = document.createElement('input');
                                input.type = 'file';
                                input.accept = 'image/*';
                                input.onchange = async (e: any) => {
                                    const file = e.target.files[0];
                                    if (file) {
                                        try {
                                            const res = await profileService.uploadProfilePhoto(file);
                                            addToast(res.message || 'Foto de perfil atualizada!', 'success');
                                            refreshUser();
                                        } catch (err: any) {
                                            addToast(readApiErrorMessage(err, 'Erro ao enviar foto.'), 'error');
                                        }
                                    }
                                };
                                input.click();
                            }}
                        >
                            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700 transition-colors overflow-hidden relative">
                                {currentUser.photoUrl ? (
                                    <img src={currentUser.photoUrl} alt={currentUser.name} className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-2xl font-black">{currentUser.name?.charAt(0) || 'U'}</span>
                                )}
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Camera size={20} className="text-white" />
                                </div>
                            </div>
                            <div className="absolute -bottom-1 -right-1 bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full border-2 border-white dark:border-slate-900 shadow-sm">
                                LVL {currentUser.level}
                            </div>
                        </div>
                        <div>
                            <h2 className="font-bold text-slate-900 dark:text-slate-100 text-sm transition-colors">{currentUser.name}</h2>
                            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium truncate max-w-[180px] transition-colors">{currentUser.email}</p>
                        </div>
                        <div className="w-full pt-3 border-t border-slate-50 dark:border-slate-800 flex justify-center transition-colors">
                            <span className={`text-[10px] font-black uppercase px-2 py-1 rounded border transition-colors ${isElitePlan ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-800/30' : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-100 dark:border-slate-700'}`}>
                                Plano {effectivePlanDisplayName}
                            </span>
                        </div>
                    </div>

                    {/* Menu */}
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1 transition-colors">
                        <div className="px-4 py-2 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest transition-colors">Menu</div>
                        <SidebarItem id="notebook" label="Minhas Anotações" icon={StickyNote} />
                        <SidebarItem id="materials" label="Meus Materiais" icon={Package} />
                        
                        <div className="h-px bg-slate-50 dark:bg-slate-800 my-2 transition-colors" />
                        
                        <div className="px-4 py-2 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest transition-colors">Conta</div>
                        <SidebarItem id="personal" label="Dados Pessoais" icon={User} />
                        <SidebarItem id="billing" label="Assinatura" icon={CreditCard} />
                        <SidebarItem id="billing-history" label="Transações" icon={BarChart3} />
                        <SidebarItem id="referral" label="Indique e Ganhe" icon={Gift} />
                        <SidebarItem id="security" label="Privacidade" icon={ShieldCheck} />
                    </div>

                    <button onClick={logout} className="w-full flex items-center justify-center gap-2 py-3 text-red-500 bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20 font-bold text-xs rounded-xl transition-all border border-red-100 dark:border-red-900/30">
                        <LogOut size={14} /> Sair da Conta
                    </button>
                </aside>

            {/* ÁREA DE CONTEÚDO */}
            <main className="lg:col-span-9 space-y-6">

               {activeTab === 'evolution' && (
                  <div className="space-y-6">
                     {/* NOVO CABEÇALHO DE ESTUDOS */}
                     <div className="bg-white dark:bg-slate-900 px-6 py-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6 transition-colors">
                        <div className="flex-1 space-y-3">
                           <div className="flex items-center gap-2">
                              <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Estudando questões para</span>
                           </div>
                           <div className="flex flex-col md:flex-row md:items-center gap-4">
                              <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 leading-tight transition-colors">
                                 {currentUser.targetExam || 'Não selecionado'}
                              </h2>
                              <div className="flex items-center gap-2">
                                 <span className="px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold rounded-lg transition-colors">Pré edital</span>
                                 <button
                                    onClick={() => setShowGoalModal(true)}
                                    className="flex items-center gap-1.5 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                 >
                                    <TrendingUp size={12} /> Trocar guia
                                 </button>
                              </div>
                           </div>
                        </div>
                        <div className="flex items-center gap-4 pl-6 border-l border-slate-100 dark:border-slate-800 transition-colors">
                           <div className="relative w-14 h-14">
                              <svg className="w-full h-full -rotate-90">
                                 <circle cx="28" cy="28" r="24" fill="transparent" stroke="currentColor" strokeWidth="4" className="text-slate-100 dark:text-slate-800" />
                                 <circle cx="28" cy="28" r="24" fill="transparent" stroke="currentColor" strokeWidth="4" strokeDasharray={2 * Math.PI * 24} strokeDashoffset={2 * Math.PI * 24 * (1 - generalStats.topicsProgress / 100)} className="text-orange-500" strokeLinecap="round" />
                              </svg>
                              <div className="absolute inset-0 flex items-center justify-center text-[11px] font-black text-slate-900 dark:text-slate-100">{generalStats.topicsProgress}%</div>
                           </div>
                           <div className="text-right">
                              <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1 justify-end">Assuntos Concluídos <Info size={10} /></p>
                              <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300 transition-colors">Todos os assuntos</p>
                           </div>
                        </div>
                     </div>

                     {/* Stats Grid */}
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
                           <div className="flex justify-between items-start mb-2">
                              <span className="p-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-lg"><Target size={18} /></span>
                              <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase">Geral</span>
                           </div>
                           <p className="text-3xl font-black text-slate-900 dark:text-slate-100 transition-colors">{generalStats.accuracy}%</p>
                           <p className="text-xs text-slate-500 dark:text-slate-400 font-medium transition-colors">Taxa de Acertos</p>
                        </div>
                        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
                           <div className="flex justify-between items-start mb-2">
                              <span className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg"><Book size={18} /></span>
                              <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase">Total</span>
                           </div>
                           <p className="text-3xl font-black text-slate-900 dark:text-slate-100 transition-colors">{generalStats.total}</p>
                           <p className="text-xs text-slate-500 dark:text-slate-400 font-medium transition-colors">Questões Respondidas</p>
                        </div>
                        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
                           <div className="flex justify-between items-start mb-2">
                              <span className="p-2 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-lg"><Zap size={18} /></span>
                              <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase">Rank</span>
                           </div>
                           <p className="text-3xl font-black text-slate-900 dark:text-slate-100 transition-colors">{generalStats.xp}</p>
                           <p className="text-xs text-slate-500 dark:text-slate-400 font-medium transition-colors">Pontos de Experiência</p>
                        </div>
                     </div>

                     {/* RESUMO DO DESEMPENHO */}
                     <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-8 transition-colors">
                        <div className="flex justify-between items-center">
                           <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-3 uppercase tracking-wide">
                              <span className="w-2 h-5 bg-orange-500 rounded-sm" /> Resumo do meu desempenho
                           </h3>
                           <div className="flex items-center gap-3">
                              <div className="flex bg-slate-50 dark:bg-slate-800 p-1 rounded-lg">
                                 {(['today', 'week', 'month', 'year'] as const).map(range => (
                                    <button
                                       key={range}
                                       onClick={() => setEvolutionRange(range)}
                                       className={`px-3 py-1 rounded text-[9px] font-black uppercase tracking-widest transition-all ${evolutionRange === range ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600'}`}
                                    >
                                       {range === 'today' ? 'Hoje' : range === 'week' ? 'Semana' : range === 'month' ? 'Mês' : 'Ano'}
                                    </button>
                                 ))}
                              </div>
                           </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
                           {/* GERAL GAUGE */}
                           <div className="md:col-span-4 bg-orange-50/30 dark:bg-orange-900/5 p-6 rounded-2xl flex flex-col items-center justify-center space-y-4">
                              <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1">Geral <Info size={10} /></h4>
                              <div className="relative w-48 h-24 overflow-hidden">
                                 <svg className="w-full h-full">
                                    <path d="M 10 90 A 80 80 0 0 1 182 90" fill="none" stroke="#f1f5f9" strokeWidth="20" strokeLinecap="round" className="dark:stroke-slate-800" />
                                    <path d="M 10 90 A 80 80 0 0 1 182 90" fill="none" stroke="url(#gradient)" strokeWidth="20" strokeLinecap="round" strokeDasharray="301" strokeDashoffset={301 * (1 - generalStats.accuracy / 100)} />
                                    <defs>
                                       <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                          <stop offset="0%" stopColor="#ef4444" />
                                          <stop offset="50%" stopColor="#f59e0b" />
                                          <stop offset="100%" stopColor="#10b981" />
                                       </linearGradient>
                                    </defs>
                                 </svg>
                                 <div className="absolute bottom-0 inset-x-0 flex flex-col items-center pb-1">
                                    <span className="text-3xl font-black text-slate-900 dark:text-slate-100">{generalStats.accuracy}%</span>
                                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${generalStats.accuracy >= 75 ? 'bg-emerald-100 text-emerald-700' : generalStats.accuracy >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                                       {generalStats.accuracy >= 75 ? 'ALTO' : generalStats.accuracy >= 50 ? 'MÉDIO' : 'BAIXO'}
                                    </span>
                                 </div>
                              </div>
                              <p className="text-[10px] text-center font-bold text-slate-500 dark:text-slate-400 max-w-[200px]">
                                 Sua probabilidade de aprovação para este cargo é {' '}
                                 <span className="text-emerald-500 font-black">{generalStats.accuracy >= 70 ? 'Superior' : 'Crescente'}</span> em relação à concorrência.
                              </p>
                           </div>

                           {/* NÍVEL DE DIFICULDADE */}
                           <div className="md:col-span-4 space-y-4">
                              <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1">Nível de dificuldade <Info size={10} /></h4>
                              <div className="space-y-4 pt-2">
                                 {Object.entries(generalStats.diffStats).map(([label, stats]) => {
                                    const acc = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
                                    return (
                                       <div key={label} className="grid grid-cols-12 items-center gap-3">
                                          <span className="col-span-3 text-[10px] font-bold text-slate-500 dark:text-slate-400">{label}</span>
                                          <div className="col-span-7 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                             <div className="h-full bg-teal-600 transition-all duration-500" style={{ width: `${acc}%` }} />
                                          </div>
                                          <span className="col-span-2 text-[10px] font-black text-slate-800 dark:text-slate-200 text-right">{acc}%</span>
                                       </div>
                                    )
                                 })}
                              </div>
                           </div>

                           {/* RESOLUÇÕES */}
                           <div className="md:col-span-4 space-y-3">
                              <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1">Resoluções <Info size={10} /></h4>
                              <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl flex justify-between items-center transition-colors">
                                 <span className="text-[11px] font-bold text-slate-900 dark:text-slate-100 text-center"><span className="text-base font-black text-indigo-600 block">{generalStats.total}</span> Resoluções</span>
                                 <div className="h-8 w-px bg-slate-200 dark:bg-slate-700" />
                                 <span className="text-[11px] font-bold text-slate-900 dark:text-slate-100 text-center"><span className="text-base font-black text-emerald-600 block">{generalStats.correct}</span> Acertos</span>
                                 <div className="h-8 w-px bg-slate-200 dark:bg-slate-700" />
                                 <span className="text-[11px] font-bold text-slate-900 dark:text-slate-100 text-center"><span className="text-base font-black text-red-600 block">{generalStats.wrong}</span> Erros</span>
                              </div>
                              <div className="pt-4 space-y-2">
                                 <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 leading-relaxed uppercase tracking-widest">Desempenho por Período</p>
                                 <div className="h-24 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                       <AreaChart data={timelineData}>
                                          <defs>
                                             <linearGradient id="colorTotalProfile" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#f97316" stopOpacity={0.1} />
                                                <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                                             </linearGradient>
                                          </defs>
                                          <XAxis dataKey="date" hide />
                                          <YAxis tick={{ fontSize: 8, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={20} />
                                          <Area type="monotone" dataKey="total" stroke="#f97316" strokeWidth={2} fill="url(#colorTotalProfile)" name="Quantidade" fillOpacity={1} />
                                          <Area type="monotone" dataKey="taxa" stroke="#6366f1" strokeWidth={1} fillOpacity={0} name="Precisão (%)" />
                                       </AreaChart>
                                    </ResponsiveContainer>
                                 </div>
                              </div>
                           </div>
                        </div>
                     </div>
                  </div>
               )}

               {activeTab === 'notebook' && (
                  <div className="space-y-6">
                     <div className="flex justify-between items-center">
                        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 transition-colors">Minhas Anotações</h2>
                        <span className="text-xs font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full transition-colors">{userNotes.length} notas</span>
                     </div>
                     {userNotes.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           {userNotes.map(n => (
                              <div key={n.id} className="p-6 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-100 dark:border-yellow-900/20 rounded-2xl group relative hover:shadow-sm transition-all">
                                 <p className="text-xs text-yellow-800 dark:text-yellow-200 font-medium leading-relaxed whitespace-pre-wrap">{n.text}</p>
                                 <div className="mt-4 pt-3 border-t border-yellow-100/50 dark:border-yellow-900/30 flex justify-between items-center">
                                    <span className="text-[10px] text-yellow-600/60 dark:text-yellow-500/40 font-bold uppercase">{new Date(n.timestamp).toLocaleDateString()}</span>
                                    <button onClick={() => saveNote(n.questionId, '')} className="text-yellow-600/60 hover:text-red-500 transition-colors"><X size={14} /></button>
                                 </div>
                              </div>
                           ))}
                        </div>
                     ) : (
                        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 border-dashed p-12 text-center transition-colors">
                           <StickyNote size={40} className="mx-auto text-slate-300 dark:text-slate-700 mb-3" />
                           <p className="text-sm text-slate-500 dark:text-slate-400 font-medium transition-colors">Nenhuma anotação encontrada.</p>
                           <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 transition-colors">Adicione notas nas questões durante seus estudos.</p>
                        </div>
                     )}
                  </div>
               )}

               {activeTab === 'materials' && (
                   <div className="space-y-6">
                       <div className="flex justify-between items-center">
                           <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 transition-colors">Meus Materiais</h2>
                           <span className="text-xs font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full transition-colors">{userMaterials.length} itens</span>
                       </div>
                       
                       {userMaterials.length > 0 ? (
                           <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
                               <table className="w-full text-left border-collapse">
                                   <thead>
                                       <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                                           <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Material</th>
                                           <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 hidden md:table-cell">Aquirido em</th>
                                           <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 text-right">Ação</th>
                                       </tr>
                                   </thead>
                                   <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                       {userMaterials.map((material: any) => {
                                           const daysSince = (Date.now() - new Date(material.purchasedAt).getTime()) / (1000 * 60 * 60 * 24);
                                           const canDownload = daysSince >= 7;
                                           
                                           return (
                                               <tr key={material.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                                   <td className="p-4">
                                                       <div className="flex items-center gap-4">
                                                           <div className="w-12 h-12 rounded-lg bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 dark:text-indigo-400 overflow-hidden shrink-0">
                                                               {material.coverUrl ? <img src={material.coverUrl} alt="" className="w-full h-full object-cover" /> : <Package size={20} />}
                                                           </div>
                                                           <div>
                                                               <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 line-clamp-1">{material.title}</h3>
                                                               <p className="text-[10px] font-black uppercase text-indigo-500 mt-0.5 tracking-tight">{material.type === 'pdf' ? 'PDF Interativo' : 'Curso Completo'}</p>
                                                           </div>
                                                       </div>
                                                   </td>
                                                   <td className="p-4 hidden md:table-cell">
                                                       <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{new Date(material.purchasedAt).toLocaleDateString()}</span>
                                                   </td>
                                                   <td className="p-4 text-right">
                                                       <div className="flex items-center justify-end gap-2">
                                                            <button 
                                                               onClick={() => navigate(`/read/${material.id}`)}
                                                               className="inline-flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200 dark:shadow-none"
                                                            >
                                                                <BookOpen size={14} /> Ler
                                                            </button>
                                                            
                                                            {canDownload ? (
                                                                <button 
                                                                    onClick={() => {
                                                                        void downloadAuthenticatedFile(buildMaterialDownloadEndpoint(material.id)).catch((error: any) => {
                                                                            addToast(error?.message || 'Não foi possível baixar o material agora.', 'error');
                                                                        });
                                                                    }}
                                                                    className="inline-flex items-center justify-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-colors shadow-sm shadow-emerald-200 dark:shadow-none"
                                                                >
                                                                    <Download size={14} /> Baixar
                                                                </button>
                                                            ) : (
                                                                <div className="group/tooltip relative">
                                                                    <button disabled className="inline-flex items-center justify-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-lg text-[10px] font-black uppercase tracking-widest cursor-not-allowed opacity-60">
                                                                        <Download size={14} /> Baixar
                                                                    </button>
                                                                    <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded shadow-lg opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-opacity z-50 normal-case font-medium">
                                                                        Download disponível em {Math.ceil(7 - daysSince)} dias (Política de Garantia).
                                                                    </div>
                                                                </div>
                                                            )}
                                                       </div>
                                                   </td>
                                               </tr>
                                           );
                                       })}
                                   </tbody>
                               </table>
                           </div>
                       ) : (
                           <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 border-dashed p-12 text-center transition-colors">
                               <Package size={40} className="mx-auto text-slate-300 dark:text-slate-700 mb-3" />
                               <p className="text-sm text-slate-500 dark:text-slate-400 font-medium transition-colors">Nenhum material adquirido.</p>
                               <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 transition-colors">Visite o Marketplace para encontrar materiais de estudo.</p>
                           </div>
                       )}
                   </div>
               )}

               {activeTab === 'personal' && (
                  <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
                      <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-6 transition-colors">Dados Pessoais</h2>
                      <form
                        onSubmit={async (e) => {
                           e.preventDefault();
                           if (isUpdatingProfile) return;
                           
                           setIsUpdatingProfile(true);
                           const formData = new FormData(e.currentTarget);
                           
                           const getValue = (name: string) => (formData.get(name) as string) || '';
                           
                           const updates = {
                               name: getValue('name'),
                               cpf: getValue('cpf').replace(/\D/g, ''),
                               targetExam: getValue('targetExam'),
                               address: {
                                  zipCode: getValue('zipCode').replace(/\D/g, ''),
                                  street: getValue('street'),
                                  number: getValue('number'),
                                  complement: getValue('complement'),
                                  neighborhood: getValue('neighborhood'),
                                  city: getValue('city'),
                                  state: getValue('state')
                               }
                           };

                           // Manual Validation for better feedback
                           if (!updates.name) { addToast('Nome é obrigatório.', 'error'); setIsUpdatingProfile(false); return; }
                           if (!updates.cpf) { addToast('CPF é obrigatório.', 'error'); setIsUpdatingProfile(false); return; }
                           if (!updates.address.zipCode) { addToast('CEP é obrigatório.', 'error'); setIsUpdatingProfile(false); return; }
                           if (!updates.address.street) { addToast('Rua é obrigatória.', 'error'); setIsUpdatingProfile(false); return; }
                           if (!updates.address.number) { addToast('Número é obrigatório.', 'error'); setIsUpdatingProfile(false); return; }
                           if (!updates.address.neighborhood) { addToast('Bairro é obrigatório.', 'error'); setIsUpdatingProfile(false); return; }
                           if (!updates.address.city) { addToast('Cidade é obrigatória.', 'error'); setIsUpdatingProfile(false); return; }
                           if (!updates.address.state) { addToast('Estado (UF) é obrigatório.', 'error'); setIsUpdatingProfile(false); return; }

                           try {
                               await updateUser(updates);
                               // Notification is handled by AuthContext
                           } catch (err: any) {
                               console.error('Profile update error:', err);
                               const msg = readApiErrorMessage(err, 'Erro ao sincronizar. Verifique sua conexão.');
                               addToast(msg, 'error');
                           } finally {
                               setIsUpdatingProfile(false);
                           }
                        }}
                        noValidate
                        className="space-y-6 max-w-2xl"
                     >
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase transition-colors">Nome Completo</label>
                            <input name="name" type="text" defaultValue={currentUser.name} className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 font-bold text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all font-sans" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase transition-colors">E-mail de Acesso</label>
                            <input name="email" type="email" defaultValue={currentUser.email} readOnly className="w-full h-11 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 font-bold text-sm text-slate-500 dark:text-slate-400 outline-none cursor-not-allowed transition-all font-sans" title="Não é possível alterar o email" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                           <div className="space-y-1.5">
                               <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase transition-colors">CPF</label>
                               <input name="cpf" type="text" defaultValue={currentUser.cpf || ''} placeholder="000.000.000-00" className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 font-bold text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/10 transition-colors font-sans" />
                           </div>
                           <div className="space-y-1.5">
                               <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase transition-colors">Foco de Estudo</label>
                               <div className="relative group/exam">
                                    <input name="targetExam" type="text" readOnly onClick={() => setShowGoalModal(true)} value={currentUser.targetExam || ''} placeholder="Selecione seu foco" className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 font-bold text-sm text-slate-900 dark:text-slate-100 outline-none cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-900 transition-colors font-sans" />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 group-hover/exam:text-indigo-500 transition-colors">
                                        <ChevronRight size={16} />
                                    </div>
                               </div>
                           </div>
                        </div>

                         <div className="space-y-4 pt-2">
                            <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-50 dark:border-slate-800 pb-2">Dados de Cobrança / Endereço</h3>
                            
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                               <div className="col-span-1 space-y-1.5">
                                   <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase">CEP</label>
                                   <input name="zipCode" type="text" defaultValue={currentUser.address?.zipCode || ''} placeholder="00000-000" className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 font-bold text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all font-sans" />
                               </div>
                               <div className="col-span-2 space-y-1.5">
                                   <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase">Logradouro / Rua</label>
                                   <input name="street" type="text" defaultValue={currentUser.address?.street || ''} placeholder="Ex: Av. Paulista" className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 font-bold text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all font-sans" />
                               </div>
                               <div className="col-span-1 space-y-1.5">
                                   <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase">Número</label>
                                   <input name="number" type="text" defaultValue={currentUser.address?.number || ''} placeholder="123" className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 font-bold text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all font-sans" />
                               </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                 <div className="space-y-1.5">
                                     <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase">Complemento (Opcional)</label>
                                     <input name="complement" type="text" defaultValue={currentUser.address?.complement || ''} placeholder="Ex: Apto 101, Bloco A" className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 font-bold text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all font-sans" />
                                 </div>
                                 <div className="space-y-1.5">
                                     <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase">Bairro</label>
                                     <input name="neighborhood" type="text" defaultValue={currentUser.address?.neighborhood || ''} placeholder="Ex: Centro" className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 font-bold text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all font-sans" />
                                 </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                               <div className="col-span-2 space-y-1.5">
                                   <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase">Cidade</label>
                                   <input name="city" type="text" defaultValue={currentUser.address?.city || ''} placeholder="Ex: São Paulo" className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 font-bold text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all font-sans" />
                               </div>
                               <div className="col-span-1 space-y-1.5">
                                   <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase">Estado (UF)</label>
                                   <input name="state" type="text" defaultValue={currentUser.address?.state || ''} placeholder="SP" maxLength={2} className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 font-bold text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all font-sans uppercase" />
                               </div>
                            </div>
                         </div>

                         <div className="pt-4 flex items-center gap-4">
                            <button 
                                type="submit" 
                                disabled={isUpdatingProfile}
                                className={`px-10 py-4 bg-slate-900 dark:bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-indigo-500/10 hover:shadow-indigo-500/25 transition-all flex items-center gap-2 ${isUpdatingProfile ? 'opacity-70 cursor-wait' : 'hover:-translate-y-1 active:scale-95'}`}
                            >
                               {isUpdatingProfile ? (
                                   <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                               ) : (
                                   <ShieldCheck size={16} />
                               )}
                                {isUpdatingProfile ? 'Sincronizando...' : 'Sincronizar Perfil'}
                            </button>
                         </div>
                     </form>

                     <div id="saved-cards-personal-section" className="mt-12 border-t border-slate-100 pt-8 dark:border-slate-800">
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                            <div>
                                <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-slate-100">Cartões Salvos</h3>
                                <p className="mt-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                    Seus cartões ficam disponíveis aqui para compras futuras e para renovação automática.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsAddingCard(!isAddingCard);
                                    if (!isAddingCard) {
                                        setStripeSetupClientSecret(null);
                                    }
                                }}
                                className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${
                                    isAddingCard
                                        ? 'border-rose-200 bg-rose-50 text-rose-600'
                                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                                }`}
                            >
                                {isAddingCard ? <X size={14} /> : <CreditCard size={14} />}
                                {isAddingCard ? 'Cancelar' : 'Adicionar cartão'}
                            </button>
                        </div>

                        <div className="mt-6 space-y-4">
                            {cardsLoadError && (
                                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-500/20 dark:bg-amber-500/10">
                                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">Falha ao sincronizar com a Stripe</p>
                                    <p className="mt-1 text-[11px] font-medium leading-5 text-slate-600 dark:text-slate-300">
                                        {cardsLoadError}
                                    </p>
                                </div>
                            )}

                            {isStripeBilling ? (
                                <>
                                    {isAddingCard && (
                                        <div className="rounded-2xl border border-indigo-100 bg-slate-50 p-5 dark:border-indigo-900/40 dark:bg-slate-800/30">
                                            {!stripeSetupClientSecret ? (
                                                <button
                                                    type="button"
                                                    onClick={handlePrepareStripeCard}
                                                    disabled={isSavingCard}
                                                    className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:bg-indigo-700 disabled:opacity-60"
                                                >
                                                    {isSavingCard ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />}
                                                    {isSavingCard ? 'Preparando formulário...' : 'Novo cartão Stripe'}
                                                </button>
                                            ) : (
                                                <StripeSetupCardForm
                                                    publishableKey={stripePublishableKey}
                                                    clientSecret={stripeSetupClientSecret}
                                                    billingName={currentUser?.name}
                                                    billingEmail={currentUser?.email}
                                                    onSaved={handleStripeCardSaved}
                                                />
                                            )}
                                        </div>
                                    )}

                                    {isLoadingCards ? (
                                        <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 p-8 dark:border-slate-800 dark:bg-slate-800/20">
                                            <Loader2 className="animate-spin text-indigo-500" />
                                        </div>
                                    ) : userCards.length > 0 ? (
                                        <div className="space-y-3">
                                            {userCards.map((card: any) => (
                                                <div key={card.id} className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 transition-all dark:border-slate-800 dark:bg-slate-800/20 md:flex-row md:items-center md:justify-between">
                                                    <div className="flex items-center gap-4">
                                                        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${Number(card.is_default) === 1 ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-300'}`}>
                                                            <CreditCard size={20} />
                                                        </div>
                                                        <div>
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <p className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-slate-100">
                                                                    {formatMaskedCardLabelAscii(card)}
                                                                </p>
                                                                <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-indigo-600 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300">Stripe</span>
                                                                {getCardExpiryState(card).isExpired && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-rose-600 dark:bg-rose-900/30 dark:text-rose-300">Expirado</span>}
                                                                {!getCardExpiryState(card).isExpired && getCardExpiryState(card).isExpiringSoon && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">Vence em breve</span>}
                                                                {Number(card.is_default) === 1 && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">Padrão</span>}
                                                                {Number(card.locked_by_recurring) === 1 && <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-white">Assinatura ativa</span>}
                                                            </div>
                                                            <p className="mt-1 text-[10px] font-medium text-slate-500 dark:text-slate-400">
                                                                Expira em {String(card.exp_month).padStart(2, '0')}/{card.exp_year}
                                                            </p>
                                                            {Number(card.locked_by_recurring) === 1 && (
                                                                <p className="mt-1 text-[10px] font-medium text-slate-500 dark:text-slate-400">
                                                                    Este cartao esta vinculado a renovacao atual. Defina outro como padrao para liberar a remocao.
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {Number(card.is_default) !== 1 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSetDefaultCard(card.id)}
                                                                className="rounded-xl bg-slate-100 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-700 transition-all hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                                                            >
                                                                Definir padrão
                                                            </button>
                                                        )}
                                                        {Number(card.locked_by_recurring) !== 1 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveCard(card.id)}
                                                                className="rounded-xl bg-rose-50 p-2 text-rose-500 transition-all hover:bg-rose-100 dark:bg-rose-900/20 dark:hover:bg-rose-900/30"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center dark:border-slate-800">
                                            <CreditCard size={28} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                                            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Nenhum cartão salvo ainda.</p>
                                            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Adicione um cartão para acelerar compras futuras e renovações.</p>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <>
                                    {isAddingCard && (
                                        <form onSubmit={handleSaveCard} className="rounded-2xl border border-indigo-100 bg-slate-50 p-5 dark:border-indigo-900/40 dark:bg-slate-800/30">
                                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">Número do Cartão</label>
                                                    <input name="cardNumber" type="text" placeholder="0000 0000 0000 0000" required className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold outline-none dark:border-slate-700 dark:bg-slate-900" />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">Nome no Cartão</label>
                                                    <input name="cardName" type="text" placeholder="COMO ESTÁ IMPRESSO" required className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold outline-none dark:border-slate-700 dark:bg-slate-900" />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">Validade</label>
                                                    <input name="expiry" type="text" placeholder="12/30" required className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold outline-none dark:border-slate-700 dark:bg-slate-900" />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">Bandeira</label>
                                                    <select name="brand" className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold outline-none dark:border-slate-700 dark:bg-slate-900">
                                                        <option value="visa">Visa</option>
                                                        <option value="mastercard">Mastercard</option>
                                                        <option value="elo">Elo</option>
                                                        <option value="amex">Amex</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <button disabled={isSavingCard} type="submit" className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:bg-indigo-700 disabled:opacity-60">
                                                {isSavingCard ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                                                {isSavingCard ? 'Salvando...' : 'Salvar cartão com segurança'}
                                            </button>
                                        </form>
                                    )}

                                    {isLoadingCards ? (
                                        <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 p-8 dark:border-slate-800 dark:bg-slate-800/20">
                                            <Loader2 className="animate-spin text-indigo-500" />
                                        </div>
                                    ) : userCards.length > 0 ? (
                                        <div className="space-y-3">
                                            {userCards.map((card: any) => (
                                                <div key={card.id} className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 transition-all dark:border-slate-800 dark:bg-slate-800/20 md:flex-row md:items-center md:justify-between">
                                                    <div className="flex items-center gap-4">
                                                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                                                            <CreditCard size={20} />
                                                        </div>
                                                        <div>
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <p className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-slate-100">{formatMaskedCardLabelAscii(card, { includeBrand: false })}</p>
                                                                {Number(card.is_default) === 1 && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">Padrão</span>}
                                                            </div>
                                                            <p className="mt-1 text-[10px] font-medium text-slate-500 dark:text-slate-400">
                                                                Vence em {String(card.exp_month).padStart(2, '0')}/{card.exp_year}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {Number(card.is_default) !== 1 && (
                                                            <button type="button" onClick={() => handleSetDefaultCard(card.id)} className="rounded-xl bg-slate-100 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-700 transition-all hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
                                                                Definir padrão
                                                            </button>
                                                        )}
                                                        {Number(card.locked_by_recurring) !== 1 && (
                                                            <button type="button" onClick={() => handleRemoveCard(card.id)} className="rounded-xl bg-rose-50 p-2 text-rose-500 transition-all hover:bg-rose-100 dark:bg-rose-900/20 dark:hover:bg-rose-900/30">
                                                                <Trash2 size={16} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center dark:border-slate-800">
                                            <CreditCard size={28} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                                            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Nenhum cartão salvo ainda.</p>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                     </div>
                  </div>
               )}

               {activeTab === 'billing' && renderBillingTab()}

               {false && activeTab === 'billing' && (
                  <div className="space-y-6">
                     {/* Alerta de Problema de Pagamento */}
                     {currentUser.paymentIssue && (
                        <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 p-5 rounded-2xl flex items-center gap-5 transition-all">
                           <div className="w-12 h-12 bg-rose-600 rounded-full flex items-center justify-center shrink-0 shadow-lg shadow-rose-500/20">
                              <ShieldAlert size={24} className="text-white" />
                           </div>
                           <div className="flex-1 space-y-0.5">
                              <h3 className="text-sm font-black text-rose-600 dark:text-rose-500 uppercase tracking-tight">Pagamento Pendente</h3>
                              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 leading-tight">
                                 {currentUser.paymentIssue.message || 'Atualize seus dados para evitar o bloqueio total da sua conta.'}
                              </p>
                           </div>
                            <button 
                               onClick={() => {
                                  openSavedCardsManager();
                               }}
                               className="px-4 py-2 bg-slate-900 dark:bg-rose-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:shadow-lg transition-all"
                            >
                               Resolver
                            </button>
                        </div>
                     )}

                     {/* Resumo da Assinatura */}
                     <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors overflow-hidden relative">
                        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                            <CreditCard size={120} className="text-indigo-600" />
                        </div>
                        
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Assinatura Ativa</h4>
                                    {hasActiveSubscription && <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                                    <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                        {billingProviderLabel}
                                    </span>
                                </div>
                                <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2 tracking-tight">
                                    Plano {effectivePlanDisplayName}
                                    {isElitePlan && <Crown className="text-amber-500" size={20} />}
                                </h3>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-tight">
                                    {currentUser.subscription?.current_period_end 
                                        ? `Sua assinatura renova automaticamente em ${new Date(currentUser.subscription.current_period_end).toLocaleDateString()}.`
                                        : 'Acesse recursos essenciais para sua aprovação.'}
                                </p>
                            </div>

                            {currentUser.subscription?.current_period_end && (
                                <div className="flex flex-col items-end gap-1 text-right animate-in fade-in duration-500">
                                    <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.1em]">Dias Restantes</div>
                                    <div className="text-3xl font-black text-slate-900 dark:text-slate-100 tabular-nums">
                                        {(() => {
                                            const diff = new Date(currentUser.subscription.current_period_end).getTime() - new Date().getTime();
                                            const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
                                            return days > 0 ? days : 0;
                                        })()}
                                    </div>
                                    
                                    {hasActiveSubscription && (
                                        <div className="flex flex-col items-end gap-2 mt-2">
                                            {userTransactions.some((t:any) => t.status === 'refund_requested') ? (
                                                <div className="flex flex-col items-end gap-1">
                                                    <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded border border-amber-200/50">Reembolso em Análise</span>
                                                    <button 
                                                        onClick={async () => {
                                                            if (window.confirm('Deseja realmente cancelar sua solicitação de reembolso? Sua assinatura permanecerá ativa.')) {
                                                                try {
                                                                    const res: any = await planService.cancelRefundRequest();
                                                                    if (res.success) {
                                                                        addToast(res.message, 'success');
                                                                        refreshUser();
                                                                        fetchUserTransactions();
                                                                    }
                                                                } catch (err: any) {
                                                                    addToast('Erro ao cancelar solicitação.', 'error');
                                                                }
                                                            }
                                                        }}
                                                        className="text-[9px] font-black text-slate-400 hover:text-indigo-600 uppercase tracking-widest underline underline-offset-2 transition-colors"
                                                    >
                                                        Cancelar Solicitação
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-end gap-1">
                                                    {(() => {
                                                        if (!currentUser.subscription?.current_period_start) return null;
                                                        const start = new Date(currentUser.subscription.current_period_start).getTime();
                                                        const now = new Date().getTime();
                                                        const isWithinSevenDays = (now - start) < (7 * 24 * 60 * 60 * 1000);
                                                        
                                                        if (isWithinSevenDays) {
                                                            return (
                                                                <button 
                                                                    onClick={() => setShowCancelModal(true)}
                                                                    className="text-[10px] font-black text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 uppercase tracking-widest transition-colors"
                                                                >
                                                                    Cancelar e Solicitar Reembolso
                                                                </button>
                                                            );
                                                        } else {
                                                            return (
                                                                <div className="flex items-center gap-1.5 opacity-60">
                                                                    <ShieldCheck size={12} className="text-emerald-500" />
                                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Compromisso Ativo</span>
                                                                </div>
                                                            );
                                                        }
                                                    })()}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                             )}
                        </div>

                        {/* Toggle de Renovação Automática */}
                        {currentUser.subscription && hasActiveSubscription && (
                            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between animate-in fade-in slide-in-from-bottom-2 duration-500">
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${currentUser.subscription?.auto_renew ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600' : 'bg-slate-50 dark:bg-slate-800 text-slate-400'}`}>
                                        <RotateCcw size={18} className={currentUser.subscription?.auto_renew ? 'animate-spin-slow' : ''} />
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">Renovação Automática</h4>
                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                                            {currentUser.subscription?.auto_renew 
                                                ? 'Seu plano será renovado automaticamente ao fim do ciclo.' 
                                                : 'Sua assinatura será encerrada ao final do período atual.'}
                                        </p>
                                    </div>
                                </div>
                                <div 
                                    onClick={handleRenewalToggle}
                                    className={`w-11 h-6 rounded-full relative cursor-pointer transition-all duration-300 shadow-inner ${currentUser.subscription?.auto_renew ? 'bg-emerald-500 shadow-emerald-600/20' : 'bg-slate-200 dark:bg-slate-700'}`}
                                >
                                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all duration-300 shadow-lg ${currentUser.subscription?.auto_renew ? 'right-0.5' : 'left-0.5'}`} />
                                </div>
                            </div>
                        )}
                     </div>

                     {/* CTA Ver Planos (Atrativo) */}
                     {(!hasActiveSubscription || !isElitePlan) && (
                        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-3xl p-6 text-white relative overflow-hidden shadow-xl shadow-indigo-200 dark:shadow-none animate-in fade-in zoom-in duration-700 transition-all hover:scale-[1.01]">
                             <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none transform translate-x-1/4 -translate-y-1/4">
                                 <Zap size={140} className="fill-current" />
                             </div>
                             <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
                                 <div className="space-y-1">
                                     <div className="flex items-center justify-center md:justify-start gap-2">
                                        <span className="bg-white/20 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest backdrop-blur-sm">Upgrade Disponível</span>
                                        <Crown size={14} className="text-amber-300" />
                                     </div>
                                     <h3 className="text-xl font-black tracking-tight leading-tight italic">Torne-se Elite e acelere sua aprovação!</h3>
                                     <p className="text-[11px] font-medium text-indigo-100 max-w-sm opacity-80">Acesse simulados exclusivos, mentoria com IA e banco de questões ilimitado.</p>
                                 </div>
                                 <button 
                                    onClick={() => navigate('/plans')}
                                    className="px-8 py-3 bg-white text-indigo-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all active:scale-95 shadow-lg shadow-black/10 flex items-center gap-2 shrink-0 group"
                                 >
                                    Ver Planos Premium <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                                 </button>
                             </div>
                        </div>
                     )}

                     {/* Métodos de Pagamento */}
                     <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors overflow-hidden">
                        {isStripeBilling && !usesInternalStripeVault ? (
                            <>
                                <header className="p-6 border-b border-slate-50 dark:border-slate-800 flex justify-between items-center">
                                    <div>
                                        <h3 id="save-card-section" className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest">Billing Portal</h3>
                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">Cartões, cobranças futuras e faturas ficam centralizados na Stripe.</p>
                                    </div>
                                    <button
                                        onClick={handleOpenStripePortal}
                                        disabled={isOpeningBillingPortal}
                                        className="px-4 py-2 border rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-60"
                                    >
                                        {isOpeningBillingPortal ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
                                        {isOpeningBillingPortal ? 'Abrindo...' : 'Abrir Portal'}
                                    </button>
                                </header>

                                <div className="p-6 space-y-4">
                                    <div className="rounded-2xl border border-indigo-100 dark:border-indigo-900/30 bg-indigo-50 dark:bg-indigo-950/20 p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-300">Provider ativo</p>
                                            <h4 className="text-sm font-black text-slate-900 dark:text-slate-100">{billingProviderLabel}</h4>
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                                                Use o portal para trocar o cartão, acompanhar faturas, corrigir falhas de pagamento e manter a assinatura pronta para as renovacoes automaticas.
                                            </p>
                                        </div>
                                        <button
                                            onClick={handleOpenStripePortal}
                                            disabled={isOpeningBillingPortal}
                                            className="px-5 py-3 bg-slate-900 dark:bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 dark:hover:bg-indigo-500 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                                        >
                                            {isOpeningBillingPortal ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
                                            {isOpeningBillingPortal ? 'Abrindo Portal...' : 'Gerenciar na Stripe'}
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-4">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Metodos de pagamento</p>
                                            <p className="mt-2 text-[12px] text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                                                O cartão padrao fica salvo no cliente Stripe e pode ser atualizado a qualquer momento sem passar por armazenamento local na plataforma.
                                            </p>
                                        </div>
                                        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-4">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Falhas e cobrancas</p>
                                            <p className="mt-2 text-[12px] text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                                                Quando uma renovação falhar, o aluno atualiza o metodo no portal e o backend sincroniza o estado da assinatura via webhook.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <footer className="px-6 py-4 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-50 dark:border-slate-800 flex items-center gap-3">
                                    <Info size={14} className="text-slate-400 shrink-0" />
                                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wide leading-relaxed">
                                        SEUS DADOS DE COBRANÇA SAO PROCESSADOS COM SEGURANÇA PELA STRIPE. CARTOES, FATURAS E TENTATIVAS DE PAGAMENTO SAO GERENCIADOS NO BILLING PORTAL.
                                    </p>
                                </footer>
                            </>
                        ) : isStripeBilling && usesInternalStripeVault ? (
                            <>
                                <header className="p-6 border-b border-slate-50 dark:border-slate-800 flex justify-between items-center">
                                    <div>
                                        <h3 id="save-card-section" className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest">Cofre Stripe</h3>
                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">Cartões, padrão de renovação e cofre externo da Stripe geridos dentro da sua plataforma.</p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setIsAddingCard(!isAddingCard);
                                            if (!isAddingCard) {
                                                setStripeSetupClientSecret(null);
                                            }
                                        }}
                                        className={`px-4 py-2 border rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${isAddingCard ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                                    >
                                        {isAddingCard ? <X size={14} /> : <CreditCard size={14} />} {isAddingCard ? 'Cancelar' : 'Novo Cartão'}
                                    </button>
                                </header>

                                <div className="p-6 space-y-4">
                                    <div className="rounded-2xl border border-indigo-100 dark:border-indigo-900/30 bg-indigo-50 dark:bg-indigo-950/20 p-5">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-300">Provider ativo</p>
                                        <h4 className="mt-2 text-sm font-black text-slate-900 dark:text-slate-100">{billingProviderLabel}</h4>
                                        <p className="mt-2 text-[11px] text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                                            O cartão continua tokenizado e guardado na Stripe, mas a gestão de cartão padrão, adição e remoção acontece nesta tela.
                                        </p>
                                    </div>

                                    {isAddingCard && (
                                        <div className="mb-8 p-6 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 animate-in slide-in-from-top-4 duration-300 space-y-4">
                                            {!stripeSetupClientSecret ? (
                                                <button
                                                    onClick={handlePrepareStripeCard}
                                                    disabled={isSavingCard}
                                                    className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                                                >
                                                    {isSavingCard ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />}
                                                    {isSavingCard ? 'Preparando formulário...' : 'Adicionar cartão Stripe'}
                                                </button>
                                            ) : (
                                                <StripeSetupCardForm
                                                    publishableKey={stripePublishableKey}
                                                    clientSecret={stripeSetupClientSecret}
                                                    billingName={currentUser?.name}
                                                    billingEmail={currentUser?.email}
                                                    onSaved={handleStripeCardSaved}
                                                />
                                            )}
                                        </div>
                                    )}

                                    {isLoadingCards ? (
                                        <div className="text-sm text-slate-500">Carregando cartões...</div>
                                    ) : userCards.length > 0 ? (
                                        <div className="space-y-3">
                                            {userCards.map((card: any) => (
                                                <div key={card.id} className="group flex flex-col md:flex-row items-start md:items-center justify-between p-4 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-700 transition-all bg-slate-50 dark:bg-slate-800/20">
                                                    <div className="flex items-center gap-4">
                                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${card.is_default == 1 ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                                                            <CreditCard size={20} />
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <p className="font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest text-xs">{formatMaskedCardLabelAscii(card)}</p>
                                                                {card.is_default == 1 && <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[9px] font-black uppercase tracking-widest">Padrão</span>}
                                                            </div>
                                                            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-1">Expira em {String(card.exp_month).padStart(2, '0')}/{card.exp_year}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-4 md:mt-0">
                                                        {card.is_default != 1 && (
                                                            <button onClick={() => handleSetDefaultCard(card.id)} className="px-3 py-2 bg-slate-100 dark:bg-slate-800 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
                                                                Definir padrão
                                                            </button>
                                                        )}
                                                        <button onClick={() => handleRemoveCard(card.id)} className="p-2 rounded-xl bg-rose-50 dark:bg-rose-900/20 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/30 transition-all">
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-10 text-slate-400">
                                            <CreditCard size={32} className="mx-auto mb-3 opacity-50" />
                                            <p className="text-sm font-medium">Nenhum cartão Stripe salvo ainda.</p>
                                        </div>
                                    )}
                                </div>

                                <footer className="px-6 py-4 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-50 dark:border-slate-800 flex items-center gap-3">
                                    <Info size={14} className="text-slate-400 shrink-0" />
                                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wide leading-relaxed">
                                        O DADO SENSÍVEL CONTINUA NO COFRE DA STRIPE. A PLATAFORMA EXIBE E GERENCIA APENAS O ESPELHO OPERACIONAL PARA O ALUNO.
                                    </p>
                                </footer>
                            </>
                        ) : (
                            <>
                        <header className="p-6 border-b border-slate-50 dark:border-slate-800 flex justify-between items-center">
                            <div>
                                <h3 id="save-card-section" className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest">Formas de Pagamento</h3>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">Gerencie seus cartões salvos para renovações automáticas.</p>
                            </div>
                            <button 
                                onClick={() => setIsAddingCard(!isAddingCard)}
                                className={`px-4 py-2 border rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${isAddingCard ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                            >
                                {isAddingCard ? <X size={14} /> : <CreditCard size={14} />} {isAddingCard ? 'Cancelar' : 'Novo Cartão'}
                            </button>
                        </header>
                        
                        <div className="p-6 space-y-4">
                            {isAddingCard && (
                                <form onSubmit={handleSaveCard} className="mb-8 p-6 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 animate-in slide-in-from-top-4 duration-300">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase">Número do Cartão</label>
                                            <input name="cardNumber" type="text" placeholder="0000 0000 0000 0000" required className="w-full h-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 text-sm font-bold outline-none font-mono" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase">Nome no Cartão</label>
                                            <input name="cardName" type="text" placeholder="JOÃO SILVA" required className="w-full h-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 text-sm font-bold outline-none" />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase">Validade (MM/AA)</label>
                                                <input name="expiry" type="text" placeholder="12/30" required className="w-full h-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 text-sm font-bold outline-none" />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase">Bandeira</label>
                                                <select name="brand" className="w-full h-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 text-sm font-bold outline-none">
                                                    <option value="visa">Visa</option>
                                                    <option value="mastercard">Mastercard</option>
                                                    <option value="elo">Elo</option>
                                                    <option value="amex">Amex</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                    <button disabled={isSavingCard} type="submit" className="w-full h-10 bg-indigo-600 text-white rounded-lg text-xs font-black uppercase tracking-widest hover:bg-indigo-500 transition-all flex items-center justify-center gap-2">
                                        {isSavingCard ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />} 
                                        {isSavingCard ? 'Salvando...' : 'Salvar Cartão com Segurança'}
                                    </button>
                                </form>
                            )}

                            {isLoadingCards ? (
                                <div className="flex justify-center p-8"><Loader2 className="animate-spin text-indigo-500" /></div>
                            ) : userCards.length > 0 ? (
                                userCards.map((card: any) => (
                                    <div key={card.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800/50 hover:border-indigo-200 dark:hover:border-indigo-900/40 transition-all group">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-8 bg-white dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-800 flex items-center justify-center p-1 shadow-sm">
                                                <img src={`https://img.icons8.com/color/48/000000/${card.brand?.toLowerCase() || 'credit-card'}.png`} alt={card.brand} className="h-full object-contain" onError={(e:any) => e.target.src = 'https://img.icons8.com/color/48/000000/credit-card.png'} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-widest">
                                                        {formatMaskedCardLabelAscii(card, { includeBrand: false })}
                                                    </span>
                                                    {card.is_default === 1 && <span className="text-[8px] font-black uppercase bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-200/50">Padrão</span>}
                                                    {card.locked_by_recurring === 1 && (
                                                        <div className="group/lock relative">
                                                            <span className="text-[8px] font-black uppercase bg-indigo-600 text-white px-2 py-0.5 rounded flex items-center gap-1 cursor-help shadow-sm">
                                                                <ShieldAlert size={8} /> Assinatura Ativa
                                                            </span>
                                                            <div className="absolute bottom-full left-0 mb-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded shadow-lg opacity-0 group-hover/lock:opacity-100 pointer-events-none transition-opacity z-50 font-medium normal-case">
                                                                Este cartão é o método de pagamento da sua assinatura principal.
                                                            </div>
                                                        </div>
                                                    )}
                                                    {(() => {
                                                        const now = new Date();
                                                        const isExpired = card.exp_year < now.getFullYear() || (card.exp_year === now.getFullYear() && card.exp_month < (now.getMonth() + 1));
                                                        if (isExpired) {
                                                            return (
                                                                <span className="text-[8px] font-black uppercase bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 px-1.5 py-0.5 rounded border border-rose-200/50 flex items-center gap-1 animate-pulse">
                                                                    <AlertTriangle size={8} /> Expirado
                                                                </span>
                                                            );
                                                        }
                                                        return null;
                                                    })()}
                                                </div>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5 tracking-tight">Vence em {card.exp_month.toString().padStart(2, '0')}/{card.exp_year}</p>
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-2">
                                            {card.is_default !== 1 && (
                                                <button onClick={() => handleSetDefaultCard(card.id)} className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 px-3 py-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                                                    Definir Padrão
                                                </button>
                                            )}
                                            {card.locked_by_recurring !== 1 && (
                                                <button onClick={() => handleRemoveCard(card.id)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all">
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-6">
                                    <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <AlertCircle size={24} className="text-slate-300" />
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Nenhuma forma de pagamento cadastrada.</p>
                                </div>
                            )}
                        </div>
                        
                        <footer className="px-6 py-4 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-50 dark:border-slate-800 flex items-center gap-3">
                            <Info size={14} className="text-slate-400 shrink-0" />
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wide leading-relaxed">
                                SEUS DADOS DE PAGAMENTO SAO PROCESSADOS COM SEGURANCA PELA STRIPE E NAO FICAM ARMAZENADOS INTEGRALMENTE EM NOSSOS SERVIDORES.
                            </p>
                        </footer>
                            </>
                        )}
                     </div>
                  </div>
               )}

               {activeTab === 'billing-history' && renderBillingHistoryTab()}

               {false && activeTab === 'billing-history' && (
                  <div className="space-y-6">
                      <div className="flex justify-between items-center">
                          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 transition-colors">Histórico de Transações</h2>
                          <button onClick={fetchUserTransactions} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"><RotateCcw size={18} /></button>
                      </div>

                      {isLoadingTransactions ? (
                          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-20 flex justify-center"><Loader2 size={32} className="animate-spin text-indigo-500" /></div>
                      ) : userTransactions.length > 0 ? (
                          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
                              <table className="w-full text-left">
                                  <thead>
                                      <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                                          <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Data</th>
                                          <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Descrição</th>
                                          <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 text-center">Status</th>
                                          <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 text-right">Valor</th>
                                      </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                      {userTransactions.map((tx: any) => (
                                          <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                              <td className="p-4"><span className="text-xs font-bold text-slate-500 dark:text-slate-400">{tx.dateFormatted}</span></td>
                                              <td className="p-4">
                                                  <div className="flex items-center gap-3">
                                                      <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400"><Package size={14} /></div>
                                                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{tx.description || 'Assinatura'}</span>
                                                  </div>
                                              </td>
                                              <td className="p-4 text-center">
                                                  <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full ${
                                                      tx.status === 'approved' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400' :
                                                      tx.status === 'pending' ? 'bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400' :
                                                      tx.status === 'refunded' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400' :
                                                      'bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400'
                                                  }`}>
                                                      {tx.status === 'approved' ? 'Aprovado' : tx.status === 'pending' ? 'Pendente' : tx.status === 'refunded' ? 'Estornado' : 'Cancelado'}
                                                  </span>
                                              </td>
                                              <td className="p-4 text-right"><span className="text-xs font-black text-slate-900 dark:text-slate-100">R$ {parseFloat(tx.amount).toFixed(2)}</span></td>
                                          </tr>
                                      ))}
                                  </tbody>
                              </table>
                          </div>
                      ) : (
                          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 border-dashed p-12 text-center transition-colors">
                              <BarChart3 size={40} className="mx-auto text-slate-300 dark:text-slate-700 mb-3" />
                              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium tracking-tight">Nenhuma transação registrada.</p>
                          </div>
                      )}
                  </div>
               )}

               {activeTab === 'referral' && (
                   <div className="space-y-6">
                       {/* Banner do Programa */}
                       <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-700 rounded-3xl p-8 text-white relative overflow-hidden shadow-xl shadow-indigo-200 dark:shadow-none">
                            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                                <Gift size={160} />
                            </div>
                            <div className="max-w-md relative z-10 space-y-4">
                                <span className="bg-white/20 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest backdrop-blur-sm">Programa de Parceria</span>
                                <h2 className="text-3xl font-black tracking-tight leading-tight">Indique amigos e ganhe 20% de comissão!</h2>
                                <p className="text-sm font-medium text-indigo-100 leading-relaxed">Compartilhe seu link exclusivo. Cada nova assinatura em planos Elite através do seu link gera créditos automáticos para você.</p>
                                
                                <div className="pt-4 flex items-center gap-3">
                                    <div className="flex-1 bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 flex items-center justify-between gap-4">
                                        <code className="text-xs font-black tracking-widest text-indigo-100 truncate">
                                            https://concursomestre.com/r/{currentUser.id}
                                        </code>
                                        <button 
                                            onClick={() => {
                                                navigator.clipboard.writeText(`https://concursomestre.com/r/${currentUser.id}`);
                                                setIsCopying(true);
                                                addToast('Link copiado para a área de transferência!', 'success');
                                                setTimeout(() => setIsCopying(false), 2000);
                                            }}
                                            className="px-4 py-2 bg-white text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all active:scale-95 flex items-center gap-2 shrink-0"
                                        >
                                            {isCopying ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                                            {isCopying ? 'Copiado' : 'Copiar'}
                                        </button>
                                    </div>
                                    <button className="p-4 bg-indigo-500/30 hover:bg-indigo-500/40 rounded-2xl border border-white/20 transition-all">
                                        <Share2 size={20} />
                                    </button>
                                </div>
                            </div>
                       </div>

                       {/* Stats das Indicações */}
                       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                           {[
                               { label: 'Total de Cliques', value: referralStats?.clicks || 0, icon: MousePointer2, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                               { label: 'Indicações Ativas', value: referralStats?.conversions || 0, icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                               { label: 'Saldo a Receber', value: `R$ ${(referralStats?.balance || 0).toFixed(2)}`, icon: Wallet, color: 'text-amber-600', bg: 'bg-amber-50' }
                           ].map((stat, i) => (
                               <div key={i} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
                                   <div className="flex items-center gap-4">
                                       <div className={`w-12 h-12 rounded-xl ${stat.bg} dark:bg-slate-800 flex items-center justify-center ${stat.color} transition-colors`}>
                                           <stat.icon size={24} />
                                       </div>
                                       <div>
                                           <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest transition-colors">{stat.label}</p>
                                           <h4 className="text-xl font-black text-slate-900 dark:text-slate-100 transition-colors">{stat.value}</h4>
                                       </div>
                                   </div>
                               </div>
                           ))}
                       </div>

                       {/* Como funciona */}
                       <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6 transition-colors">
                            <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest">Como funciona o programa?</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                {[
                                    { step: '01', title: 'Compartilhe o Link', desc: 'Envie para amigos ou em grupos de estudo.' },
                                    { step: '02', title: 'Amigo Assina', desc: 'Sua indicação ganha acesso ao melhor conteúdo.' },
                                    { step: '03', title: 'Você Ganha 20%', desc: 'Receba sua comissão sobre o valor da assinatura.' }
                                ].map((step, i) => (
                                    <div key={i} className="space-y-2">
                                        <div className="text-2xl font-black text-indigo-600/20 dark:text-indigo-500/10 italic leading-none">{step.step}</div>
                                        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 transition-colors">{step.title}</h4>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed transition-colors">{step.desc}</p>
                                    </div>
                                ))}
                            </div>
                       </div>
                   </div>
               )}

               {activeTab === 'security' && (
                  <div className="space-y-6">
                      {/* Alteração de Senha */}
                      <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
                          <div className="flex items-center gap-3 mb-6">
                              <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400"><Shield size={20} /></div>
                              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight transition-colors">Segurança da Conta</h2>
                          </div>
                          
                          <form 
                              onSubmit={async (e) => {
                                  e.preventDefault();
                                  const formData = new FormData(e.currentTarget);
                                  const current = formData.get('currentPassword') as string;
                                  const newPass = formData.get('newPassword') as string;
                                  const confirm = formData.get('confirmPassword') as string;
                                  
                                  if (newPass !== confirm) return addToast('As senhas não coincidem.', 'error');
                                  
                                  try {
                                      const res = await profileService.changePassword(current, newPass);
                                      addToast(res.message || 'Senha alterada com sucesso!', 'success');
                                      (e.target as HTMLFormElement).reset();
                                  } catch (err: any) {
                                      addToast(readApiErrorMessage(err, 'Falha na comunicação com o servidor.'), 'error');
                                  }
                              }}
                              className="space-y-4 max-w-md"
                          >
                              <div className="space-y-1.5 font-sans">
                                  <label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Senha Atual</label>
                                  <input name="currentPassword" type="password" required className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all font-sans" />
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  <div className="space-y-1.5 font-sans">
                                      <label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Nova Senha</label>
                                      <input name="newPassword" type="password" required className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all font-sans" />
                                  </div>
                                  <div className="space-y-1.5 font-sans">
                                      <label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Confirmar Nova Senha</label>
                                      <input name="confirmPassword" type="password" required className="w-full h-11 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all font-sans" />
                                  </div>
                              </div>
                              <button type="submit" className="px-6 py-3 bg-slate-900 dark:bg-slate-800 text-white dark:text-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-md">
                                  Atualizar Senha
                              </button>
                          </form>
                      </div>

                      {/* Preferências de Privacidade */}
                      <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
                         <div className="flex justify-between items-center mb-6">
                             <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 transition-colors">Privacidade e Preferências</h2>
                             <button onClick={() => addToast('Preferências salvas!', 'success')} className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest hover:underline">Salvar Tudo</button>
                         </div>
                         <div className="divide-y divide-slate-100 dark:divide-slate-800">
                            {[
                               { id: 'isPublic', label: 'Perfil Público (Ranking)', desc: 'Permite que seu nome apareça nos rankings de simulados.', checked: currentUser.preferences?.isPublic, icon: Users },
                               { id: 'notifications', label: 'Notificações por Email', desc: 'Receba alertas sobre novos simulados e promoções.', checked: currentUser.preferences?.notifications, icon: Bell },
                               { id: 'shareData', label: 'Compartilhar Dados de Estudo', desc: 'Sua atividade ajuda a IA a melhorar as recomendações (Anônimo).', checked: currentUser.preferences?.shareData, icon: Zap }
                            ].map((item, i) => (
                               <div key={i} className="flex items-center justify-between py-5 group">
                                  <div className="flex items-start gap-4">
                                     <div className="mt-1 text-slate-400 group-hover:text-indigo-500 transition-colors"><item.icon size={20} /></div>
                                     <div>
                                        <span className="text-sm font-bold text-slate-900 dark:text-slate-100 block transition-colors">{item.label}</span>
                                        <span className="text-xs text-slate-500 dark:text-slate-400 block mt-0.5 transition-colors">{item.desc}</span>
                                     </div>
                                  </div>
                                  <div 
                                    onClick={() => updateUser({ preferences: { ...currentUser.preferences, [item.id]: !item.checked } })}
                                    className={`w-11 h-6 rounded-full relative cursor-pointer transition-all duration-300 ${item.checked ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-800'}`}
                                  >
                                     <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 ${item.checked ? 'right-1' : 'left-1'} shadow-sm`} />
                                  </div>
                               </div>
                            ))}
                         </div>
                      </div>

                      {/* Zona de Perigo */}
                      <div className="bg-rose-50/50 dark:bg-rose-950/10 p-8 rounded-2xl border border-rose-100 dark:border-rose-900/30 transition-colors">
                          <h3 className="text-sm font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest mb-2">Excluir Conta</h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-4">Esta ação é irreversível e excluirá todos os seus materiais, progresso e dados permanentemente.</p>
                          <button className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest flex items-center gap-2 hover:bg-rose-600 hover:text-white px-4 py-2 rounded-xl border border-rose-200 dark:border-rose-900/50 transition-all">
                              <LogOut size={14} /> Solicitar Exclusão
                          </button>
                      </div>
                  </div>
               )}

            </main>
         </div>

         {/* Modal de Seleção de Meta */}
         {showGoalModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in transition-all">
               <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in slide-in-from-bottom-4 duration-300">
                  <header className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                     <div>
                        <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">Escolha seu foco</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Selecione a área para a qual você está estudando.</p>
                     </div>
                     <button onClick={() => setShowGoalModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-400"><X size={20} /></button>
                  </header>

                  <div className="p-6 max-h-[60vh] overflow-y-auto no-scrollbar space-y-8">
                     {EXAM_AREAS.map(group => (
                        <div key={group.group} className="space-y-3">
                           <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">{group.group}</h4>
                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
{group.areas.map(area => (
                                 <button
                                    key={area}
                                    onClick={() => {
                                       updateUser({ targetExam: area });
                                       setShowGoalModal(false);
                                    }}
                                     className={`flex items-center justify-between p-4 rounded-2xl border text-left transition-all group ${currentUser.targetExam === area ? 'bg-indigo-50 dark:bg-indigo-900/40 border-indigo-600' : 'bg-slate-50 dark:bg-slate-800/50 border-transparent hover:border-slate-200 dark:hover:border-slate-700'}`}
                                 >
                                    <span className={`text-sm font-bold ${currentUser.targetExam === area ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-400'}`}>{area}</span>
                                       {currentUser.targetExam === area ? (
                                       <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center"><ChevronRight size={12} className="text-white" /></div>
                                    ) : (
                                       <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><ChevronRight size={12} className="text-slate-400" /></div>
                                    )}
                                 </button>
                              ))}
                           </div>
                        </div>
                     ))}
                  </div>

                  <footer className="p-6 bg-slate-50 dark:bg-slate-800/30 text-center">
                     <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium tracking-wide">ISSO AJUDARÁ A PERSONALIZAR SUAS RECOMENDAÇÕES E RANKINGS.</p>
                  </footer>
               </div>
            </div>
         )}

         {renderCancelSubscriptionModal()}

         {/* Modal de Cancelamento de Assinatura (Portal) */}
         {false && createPortal(
            <AnimatePresence>
               {showCancelModal && currentUser.subscription && (
                  <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
                     <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowCancelModal(false)}
                        className="fixed inset-0 bg-slate-900/90 backdrop-blur-md"
                     />
                     
                     <motion.div 
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-rose-100 dark:border-rose-900/20 relative z-10"
                     >
                        <div className="p-8 text-center space-y-6">
                             <div className="w-20 h-20 bg-rose-50 dark:bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-2 border-2 border-rose-100 dark:border-rose-500/20">
                                 <ShieldAlert size={40} className="text-rose-600 dark:text-rose-500" />
                             </div>

                             <div className="space-y-4">
                                 <div className="space-y-2">
                                     <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100 italic">
                                         Já vai nos deixar, {currentUser.name?.split(' ')[0]}?
                                     </h3>
                                     <p className="text-sm font-medium text-slate-500 dark:text-slate-400 leading-relaxed px-4">
                                         {(() => {
                                             const start = new Date(currentUser.subscription.current_period_start).getTime();
                                             const now = new Date().getTime();
                                             const isRefundable = (now - start) < (7 * 24 * 60 * 60 * 1000);
                                             
                                             if (isRefundable) {
                                                 return "Você ainda está no período de garantia. Se cancelar agora, faremos seu reembolso total, mas sua jornada rumo à aprovação perderá o fôlego da nossa IA.";
                                             }
                                             return "Sua aprovação está cada dia mais próxima! Cancelando agora, você perderá acesso ao Banco de Questões mais completo do mercado ao fim do ciclo atual.";
                                         })()}
                                     </p>
                                 </div>

                                 {/* Banner de Garantia Movido para cá */}
                                 {(() => {
                                    const start = new Date(currentUser.subscription.current_period_start).getTime();
                                    const now = new Date().getTime();
                                    const isWithinSevenDays = (now - start) < (7 * 24 * 60 * 60 * 1000);
                                    
                                    if (isWithinSevenDays) {
                                       return (
                                          <div className="bg-indigo-50 dark:bg-indigo-500/5 border border-indigo-100 dark:border-indigo-500/10 p-4 rounded-2xl flex items-center gap-4 text-left">
                                             <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/20 font-sans">
                                                <ShieldCheck size={20} className="text-white" />
                                             </div>
                                             <div className="flex-1">
                                                <h4 className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Garantia Legal de 7 Dias</h4>
                                                <p className="text-[11px] font-medium text-indigo-900/60 dark:text-indigo-300/60 leading-tight">
                                                   Sua satisfação é nossa prioridade. Cancele e receba 100% do valor de volta em até 7 dias após a contratação.
                                                </p>
                                             </div>
                                          </div>
                                       );
                                    }
                                    return null;
                                 })()}
                             </div>

                             <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl space-y-4 text-left border border-slate-100 dark:border-slate-800">
                                 <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Qual o motivo principal?</label>
                                 <select 
                                     value={cancelReason}
                                     onChange={(e) => setCancelReason(e.target.value)}
                                     className="w-full h-11 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 text-sm font-bold highlight-none outline-none focus:ring-2 focus:ring-rose-500/10"
                                 >
                                     <option value="">Selecione uma opção...</option>
                                     <option value="price">Valor da assinatura</option>
                                     <option value="usage">Não estou usando o suficiente</option>
                                     <option value="technical">Problemas técnicos</option>
                                     <option value="content">Falta de conteúdos específicos</option>
                                     <option value="other">Outros motivos</option>
                                 </select>
                             </div>

                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                                  <button
                                     onClick={() => setShowCancelModal(false)}
                                     className="h-14 bg-indigo-600 hover:bg-emerald-500 text-white font-black rounded-2xl text-xs uppercase tracking-widest shadow-xl shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 group"
                                  >
                                     <Zap size={18} className="fill-current" />
                                     Manter Acesso VIP
                                  </button>
                                  <button
                                     onClick={() => {
                                         if (!cancelReason) return addToast('Por favor, selecione um motivo.', 'warning');
                                         handleCancelSubscription();
                                     }}
                                     className="h-14 bg-transparent border-2 border-slate-200 dark:border-slate-800 text-slate-400 hover:text-rose-500 hover:border-rose-500/30 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
                                  >
                                     Confirmar Cancelamento
                                  </button>
                             </div>
                             
                             <p className="text-[9px] font-black text-slate-400 uppercase tracking-tight">
                                 VOCÊ MANTERÁ SEU ACESSO ATÉ O DIA {new Date(currentUser.subscription.current_period_end).toLocaleDateString()}
                             </p>
                        </div>
                     </motion.div>
                  </div>
               )}
            </AnimatePresence>,
            document.body
         )}
      </div>
   );
};

export default Profile;

