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

import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@providers/AuthProvider';
import { useData } from '@providers/DataProvider';
import { useToast } from '@providers/ToastProvider';
import { calculateSubscriptionProRatedCredit, getCanonicalPlanName, getConfiguredPlanDisplayName, planService, resolvePlanOffer } from '@services/plans';
import { resolveSystemFeatureFlag } from '@services/system/moduleFlags';
import { Plan, PlanConfig, PlanFeature, PlanName } from '@types';
import { authFlowService } from '@services/auth';
import { cardsService } from '@services/billing';
import { getEnabledStripePaymentMethods } from '@services/payments/stripePaymentMethodsConfig';
import LimitedOfferCountdown from '../../components/shared/marketing/LimitedOfferCountdown';
import {
    CheckCircle2, ShieldCheck, ArrowRight, ArrowLeft, CreditCard,
    Lock, User, Mail, UserPlus, LogIn, ChevronRight, Calendar, ToggleRight, ToggleLeft, AlertTriangle, XCircle,
    Award, Zap, Globe, Shield, Plus, History, Fingerprint, QrCode, FileText, RotateCcw
} from 'lucide-react';
import ReCAPTCHA from 'react-google-recaptcha';
import CheckoutHeader from './components/CheckoutHeader';
import CheckoutPaymentStage from './components/CheckoutPaymentStage';
import CheckoutStepTracker from './components/CheckoutStepTracker';
import useCheckoutSummaryAction from './hooks/useCheckoutSummaryAction';
import type { CheckoutAuthMode, CheckoutStep } from './types';
import { buildProfilePath } from '../profile/profileNavigation';

const getActivePlanBenefits = (
    plan: Plan | null,
    configuredPlanDetails?: Partial<Record<PlanName, PlanConfig>> | null,
): string[] => {
    if (!plan) return [];

    const canonicalPlan = getCanonicalPlanName(plan.name);
    const configuredFeatures = configuredPlanDetails?.[canonicalPlan]?.features;
    const sourceFeatures: PlanFeature[] = Array.isArray(configuredFeatures) && configuredFeatures.length > 0
        ? configuredFeatures
        : Array.isArray(plan.features)
            ? plan.features
            : [];

    return sourceFeatures
        .filter((feature) => feature?.included)
        .map((feature) => String(feature?.text || '').trim())
        .filter(Boolean);
};

const CheckoutPage: React.FC = () => {
    const { planId } = useParams<{ planId: string }>();
    const { currentUser, login, logout, refreshUser, updateUser } = useAuth();
    const { addToast } = useToast();
    const navigate = useNavigate();
    const location = useLocation();
    const { systemSettings } = useData();

    const [plan, setPlan] = useState<Plan | null>(null);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [proRatedCredit, setProRatedCredit] = useState(0);
    const [showDowngradeModal, setShowDowngradeModal] = useState(false);

    // Step State
    const [step, setStep] = useState<CheckoutStep>('identification');
    const [authMode, setAuthMode] = useState<CheckoutAuthMode>('register');
    const [autoRenew, setAutoRenew] = useState(true);
    const [saveCard, setSaveCard] = useState(false);
    const [countdown, setCountdown] = useState(10);

    // Auth Form State
    const [authLoading, setAuthLoading] = useState(false);
    const [acceptedCheckoutTerms, setAcceptedCheckoutTerms] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: ''
    });

    const [captchaToken, setCaptchaToken] = useState<string | null>(null);
    
    // Coupon & Review State
    const [couponCode, setCouponCode] = useState('');
    const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
    const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
    const [discountAmount, setDiscountAmount] = useState(0);
    const [appliedCouponSource, setAppliedCouponSource] = useState<'auto' | 'manual' | null>(null);
    const recaptchaRef = React.useRef<ReCAPTCHA>(null);
    const [stripeBillingMode, setStripeBillingMode] = useState<'single_installment' | 'term_recurring'>('single_installment');
    const [showCheckoutRequirementsModal, setShowCheckoutRequirementsModal] = useState(false);
    const [isSavingCheckoutRequirements, setIsSavingCheckoutRequirements] = useState(false);
    const [isResendingConfirmation, setIsResendingConfirmation] = useState(false);
    const [checkoutRequirementData, setCheckoutRequirementData] = useState({
        name: '',
        cpf: '',
        zipCode: '',
        street: '',
        number: '',
        complement: '',
        neighborhood: '',
        city: '',
        state: '',
    });

    const isDevMode = systemSettings?.appMode !== 'production';
    const recaptchaEnabled = !!systemSettings?.recaptchaEnabled && !!systemSettings?.recaptchaSiteKey;
    const activePaymentProvider = 'stripe' as const;
    const isStripeProvider = activePaymentProvider === 'stripe';
    const stripeCheckoutMode = (systemSettings?.paymentCheckoutMode || 'internal') as 'internal' | 'redirect';
    const cardVaultProvider = (systemSettings?.cardVaultProvider || 'stripe') as 'stripe';
    const isStripeInternalCheckout = stripeCheckoutMode === 'internal';
    const STRIPE_PUBLISHABLE_KEY = systemSettings?.stripePublishableKey || systemSettings?.stripeKey || '';
    const allowSameTierCycleChangeEnabled = resolveSystemFeatureFlag(systemSettings, 'sameTierCycleChangeEnabled', false);
    const checkoutEnabledPaymentMethodIds = useMemo(
        () => getEnabledStripePaymentMethods(systemSettings?.stripePaymentMethods)
            .filter((method) => method.checkoutSupported)
            .map((method) => method.id),
        [systemSettings?.stripePaymentMethods],
    );
    const selectedMethod = 'credit_card' as const;
    const setSelectedMethod = (_value: string) => undefined;
    const [paymentData, setPaymentData] = useState({
        cardNumber: '',
        cardHolder: '',
        cardExpiry: '',
        cardCvv: '',
        cpf: '',
        payerName: '',
        installments: '1'
    });

    const isRecurring = false;
    const setIsRecurring = (_value: boolean) => undefined;
    const installmentOptions: any[] = [];
    const setInstallmentOptions = (_value: any[]) => undefined;
    const paymentMethodId = '';
    const setPaymentMethodId = (_value: string) => undefined;
    const issuerId: string | null = null;
    const setIssuerId = (_value: string | null) => undefined;
    const savedCards: any[] = [];
    const setSavedCards = (_value: any[]) => undefined;
    const isUsingSavedCard = false;
    const setIsUsingSavedCard = (_value: boolean) => undefined;
    const selectedCard: any = null;
    const setSelectedCard = (_value: any) => undefined;
    const savedCardSecurityReady = false;
    const setSavedCardSecurityReady = (_value: boolean) => undefined;
    const savedCardSecurityComplete = false;
    const setSavedCardSecurityComplete = (_value: boolean) => undefined;
    const savedCardSecurityError: string | null = null;
    const setSavedCardSecurityError = (_value: string | null) => undefined;
    const requiresSavedCard = autoRenew && !isUsingSavedCard;
    const savedCardCheckoutSupported = false;
    const savedCardCheckoutBlockedMessage = 'Cartoes salvos legados foram desativados neste checkout.';
    const savedCardMpRef = { current: null as any };
    const savedCardSecurityFieldRef = { current: null as any };
    const savedCardSecurityTouchedRef = { current: false };

    const normalizePaymentMethodId = (value?: string | null): string => {
        if (!value) return '';
        return value.toString().trim().toLowerCase();
    };

    const getBrandFromCardNumber = (_number: string): string | null => null;
    const updateInstallments = async (_bin?: string, _paymentMethodId?: string) => undefined;
    const resolvePaymentMetadata = async ({ bin }: { bin?: string; fallbackPaymentMethodId?: string | null; fallbackIssuerId?: string | number | null }) => ({
        paymentMethodId: '',
        issuerId: null,
        bin: (bin || '').replace(/\D/g, '').slice(0, 8),
    });

    const maskToken = (value?: string | null): string => {
        if (!value) return 'missing';
        if (value.length <= 8) return value;
        return `${value.slice(0, 4)}...${value.slice(-4)}`;
    };

    const logCheckoutDebug = (label: string, payload: Record<string, unknown>) => {
        if (!import.meta.env.DEV) return;
        console.info(`[checkout-disabled-sdk] ${label}`, payload);
    };

    const [stripeCards, setStripeCards] = useState<any[]>([]);
    const [isLoadingStripeCards, setIsLoadingStripeCards] = useState(false);
    const [selectedStripeCardId, setSelectedStripeCardId] = useState<string | null>(null);
    const [pendingStripeSubscriptionId, setPendingStripeSubscriptionId] = useState<string | null>(null);
    const [pendingStripePaymentMethodId, setPendingStripePaymentMethodId] = useState<string | null>(null);
    const [stripePixCapability, setStripePixCapability] = useState<any>(null);

    const selectedStripeCard = useMemo(() => {
        return stripeCards.find((card: any) => card.id === selectedStripeCardId) || null;
    }, [stripeCards, selectedStripeCardId]);

    const formatCurrency = (value: number) => `R$ ${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const roundCurrency = (value: number) => Number(Number(value || 0).toFixed(2));

    /**
     * Replica o mesmo particionamento em centavos usado no backend Stripe para termos recorrentes.
     * Isso evita divergência entre o valor exibido no checkout e a primeira cobrança efetiva.
     * @since v1.0.0
     */
    const resolveStripeTermAmounts = (totalAmount: number, installmentCount: number) => {
        const safeInstallmentCount = Math.max(1, installmentCount);
        const totalCents = Math.max(0, Math.round(roundCurrency(totalAmount) * 100));

        if (safeInstallmentCount <= 1) {
            const singleAmount = roundCurrency(totalCents / 100);
            return {
                installments: 1,
                first_charge_amount: singleAmount,
                installment_amount: singleAmount,
                total_amount: singleAmount,
                first_charge_discount_amount: 0,
            };
        }

        const cycleChargeCents = Math.max(1, Math.floor(totalCents / safeInstallmentCount));
        const canonicalTermTotalCents = cycleChargeCents * safeInstallmentCount;

        return {
            installments: safeInstallmentCount,
            first_charge_amount: roundCurrency(cycleChargeCents / 100),
            installment_amount: roundCurrency(cycleChargeCents / 100),
            total_amount: roundCurrency(canonicalTermTotalCents / 100),
            first_charge_discount_amount: 0,
        };
    };

    const isUsingStripeSavedCard = Boolean(selectedStripeCard);
    const stripeRequiresSavedCard = autoRenew && !isUsingStripeSavedCard;

    useEffect(() => {
        if (!planId) {
            navigate('/plans');
            return;
        }
        loadPlan();
    }, [planId]);

    useEffect(() => {
        setSelectedStripeCardId(null);
        setPendingStripeSubscriptionId(null);
        setPendingStripePaymentMethodId(null);
    }, [isStripeProvider]);

    const loadPlan = async () => {
        try {
            const plans = await planService.getPlans();
            const found = plans.find(p => p.id === Number(planId));
            if (found) {
                setPlan(found);

                let defaultInstallments = '1';
                const unit = found.interval_unit?.toLowerCase();
                const name = found.name?.toLowerCase() || '';

                if (unit === 'year' || name.includes('anual') || name.includes('annual')) {
                    defaultInstallments = '12';
                } else if ((unit === 'month' && found.interval_count === 3) || name.includes('trimestral')) {
                    defaultInstallments = '3';
                }

                setPaymentData(prev => ({ ...prev, installments: defaultInstallments }));

                if (currentUser) {
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

                    const currentPlanInList = plans.find(p => p.id === currentUser?.subscription?.plan_id);
                    const currentPlanTier = getTier(currentUser.subscription?.plan?.name || '');
                    const currentTimeScore = currentPlanInList ? getTimeScore(currentPlanInList) : 1;

                    const targetPlanTier = getTier(found.name);
                    const targetPlanTimeScore = getTimeScore(found);

                    if (currentUser.subscription?.status === 'active') {
                        if (currentUser.subscription?.plan_id === found.id) {
                            addToast(`Voce ja possui o plano ${currentUser.subscription.plan?.name || 'Premium'} ativo.`, 'warning');
                            navigate(buildProfilePath('billing'));
                            return;
                        }

                        if (
                            (targetPlanTier < currentPlanTier && targetPlanTimeScore <= currentTimeScore)
                            || (
                                !allowSameTierCycleChangeEnabled
                                && targetPlanTier === currentPlanTier
                            )
                        ) {
      addToast(`Você já possui o plano ${currentUser.subscription.plan?.name || 'Premium'}. Não é possível assinar um plano inferior ou igual enquanto o atual estiver ativo.`, 'warning');
                            navigate(buildProfilePath('billing'));
                            return;
                        }

                        if (targetPlanTier < currentPlanTier) {
                            setShowDowngradeModal(true);
                        }
                    }

                    setProRatedCredit(
                        calculateSubscriptionProRatedCredit({
                            subscription: currentUser.subscription,
                            plans,
                        }),
                    );
                } else {
                    setProRatedCredit(0);
                }
            } else {
      addToast('Plano não encontrado', 'error');
                navigate('/plans');
            }
        } catch (error) {
            console.error('Error loading plan:', error);
            addToast('Erro ao carregar detalhes do plano', 'error');
            navigate('/plans');
        } finally {
            setLoading(false);
        }
    };

    const checkoutBaseOffer = useMemo(() => {
        if (!plan) return null;
        return resolvePlanOffer({
            plan,
            pricing: systemSettings.pricing,
            planDetails: systemSettings.planDetails,
            discountAmount: 0,
        });
    }, [plan, systemSettings.planDetails, systemSettings.pricing]);

    const couponValidationAmount = useMemo(() => {
        return Math.max(0, Number(checkoutBaseOffer?.originalCycleAmount || plan?.price || 0));
    }, [checkoutBaseOffer?.originalCycleAmount, plan?.price]);

    const checkoutOffer = useMemo(() => {
        if (!plan) return null;
        const discount = appliedCoupon ? discountAmount : 0;
        return resolvePlanOffer({
            plan,
            pricing: systemSettings.pricing,
            planDetails: systemSettings.planDetails,
            discountAmount: discount,
        });
    }, [appliedCoupon, discountAmount, plan, systemSettings.planDetails, systemSettings.pricing]);

    const limitedOfferEndsAt = systemSettings.limitedOfferCountdown?.endsAt || '';
    const hasActiveLimitedOfferCountdown = Boolean(
        systemSettings.limitedOfferCountdown?.enabled
        && limitedOfferEndsAt
        && new Date(limitedOfferEndsAt).getTime() > Date.now(),
    );
    const showCheckoutCountdown = Boolean(checkoutOffer?.hasDiscount && hasActiveLimitedOfferCountdown);

    const resetAppliedCoupon = () => {
        setAppliedCoupon(null);
        setDiscountAmount(0);
        setAppliedCouponSource(null);
    };

    useEffect(() => {
        resetAppliedCoupon();
        setCouponCode('');
    }, [plan?.id]);

    useEffect(() => {
        if (!plan?.id || couponValidationAmount <= 0 || appliedCouponSource === 'manual') {
            return;
        }

        let active = true;

        const resolveAutomaticCoupon = async () => {
            try {
                const response = await planService.validateCoupon('', couponValidationAmount, {
                    planId: plan.id,
                    targetType: 'plan',
                    targetId: plan.id,
                });

                if (!active) {
                    return;
                }

                if (response.success && response.coupon) {
                    setAppliedCoupon(response.coupon);
                    setDiscountAmount(Number(response.coupon.discount_amount || 0));
                    setAppliedCouponSource('auto');
                    return;
                }

                resetAppliedCoupon();
            } catch (error) {
                if (!active) {
                    return;
                }

                resetAppliedCoupon();
            }
        };

        void resolveAutomaticCoupon();

        return () => {
            active = false;
        };
    }, [plan?.id, couponValidationAmount, appliedCouponSource]);

    const handleExpiryChange = (value: string) => {
        let clean = value.replace(/\D/g, '');
        if (clean.length > 4) clean = clean.slice(0, 4);
        let formatted = clean;
        if (clean.length >= 3) {
            formatted = `${clean.slice(0, 2)}/${clean.slice(2)}`;
        }
        setPaymentData(prev => ({ ...prev, cardExpiry: formatted }));
    };

    const getBrandIcon = (methodId: string) => {
        const brands: Record<string, string> = {
            'visa': 'https://logopng.com.br/logos/visa-5.svg',
            'master': 'https://logopng.com.br/logos/mastercard-2.svg',
            'mastercard': 'https://logopng.com.br/logos/mastercard-2.svg',
            'elo': 'https://logopng.com.br/logos/elo-1.svg',
            'amex': 'https://logopng.com.br/logos/american-express-1.svg',
            'hipercard': 'https://logopng.com.br/logos/hipercard-1.svg',
            'diners': 'https://logopng.com.br/logos/diners-club-1.svg'
        };
        return brands[methodId.toLowerCase()] || null;
    };

    const loadSavedCards = async () => {
        if (isStripeProvider) {
            if (!currentUser) {
                setStripeCards([]);
                setSelectedStripeCardId(null);
                return;
            }

            setSavedCards([]);
            setSelectedCard(null);
            setIsUsingSavedCard(false);
            setIssuerId(null);
            setIsLoadingStripeCards(true);
            try {
                const res = await cardsService.listSavedCards();
                const nextCards = res.success ? (res.cards || []) : [];
                setStripeCards(nextCards);

                if (nextCards.length === 0) {
                    setSelectedStripeCardId(null);
                    return;
                }

                setSelectedStripeCardId((currentSelected) => {
                    if (currentSelected && nextCards.some((card: any) => card.id === currentSelected)) {
                        return currentSelected;
                    }

                    return nextCards.find((card: any) => Number(card.is_default) === 1)?.id || nextCards[0]?.id || null;
                });
            } catch (error) {
                console.error('Error fetching Stripe cards:', error);
                setStripeCards([]);
                setSelectedStripeCardId(null);
            } finally {
                setIsLoadingStripeCards(false);
            }
            return;
        }

        if (!currentUser) return;
        try {
            if (import.meta.env.DEV) console.log('ðŸ’³ Fetching saved cards for user:', currentUser.id);
            const res = await cardsService.listSavedCards();
            
            if (import.meta.env.DEV) console.log('ðŸ’³ Cards API Response:', res);

            if (res.removed_stale_cards > 0) {
          addToast('Removemos cartões salvos de uma integração legada. Salve novamente o cartão para reutilização.', 'warning');
            }

            if (res.success && res.cards && res.cards.length > 0) {
                setSavedCards(res.cards);
                const defaultCard = res.cards.find((c: any) => c.is_default == 1) || res.cards[0];
                if (defaultCard) {
                    setSelectedCard(defaultCard);
                    setIsUsingSavedCard(true);
                    setPaymentMethodId(normalizePaymentMethodId(defaultCard.payment_method_id || defaultCard.brand));
                    setIssuerId(defaultCard.issuer_id ? String(defaultCard.issuer_id) : null);
                    updateInstallments(
                        defaultCard.first_six_digits || defaultCard.bin,
                        defaultCard.payment_method_id || defaultCard.brand
                    );
                }
            } else {
                if (import.meta.env.DEV) console.warn('ðŸ’³ No saved cards found or error in response:', res);
                setSavedCards([]);
                setSelectedCard(null);
                setIsUsingSavedCard(false);
                setIssuerId(null);
            }
        } catch (e) {
            console.error('Error fetching cards:', e);
        }
    };

    useEffect(() => {
        if (currentUser) {
            loadSavedCards();
            return;
        }

        setStripeCards([]);
        setSelectedStripeCardId(null);
    }, [currentUser?.id, isStripeProvider, cardVaultProvider]);

    useEffect(() => {
        if (step === 'success') {
            const timer = setTimeout(() => {
        navigate('/profile/billing');
            }, 10000);

            const interval = setInterval(() => {
                setCountdown(prev => Math.max(0, prev - 1));
            }, 1000);

            return () => {
                clearTimeout(timer);
                clearInterval(interval);
            };
        }
    }, [step, navigate]);

    useEffect(() => {
        if (step === 'success') return;
        if (currentUser) {
            setPaymentData(prev => ({ ...prev, payerName: currentUser.name, cpf: currentUser.cpf || '' }));
            if (step === 'identification') {
                setStep('payment');
            }
            return;
        }

        setStep('identification');
    }, [currentUser, step]);

    useEffect(() => {
        if (!currentUser) {
            setStripePixCapability(null);
            return;
        }

        let mounted = true;
        planService.getStripePixCapability()
            .then((response) => {
                if (mounted) setStripePixCapability(response);
            })
            .catch(() => {
                if (mounted) {
                    setStripePixCapability({
                        status: 'unavailable',
                        available: false,
                        message: 'Não foi possível consultar o status PIX na Stripe agora.',
                    });
                }
            });

        return () => {
            mounted = false;
        };
    }, [currentUser?.id]);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setAuthLoading(true);

        try {
            if (authMode === 'register') {
                if (formData.password !== formData.confirmPassword) {
        addToast('As senhas não coincidem.', 'error');
                    setAuthLoading(false);
                    return;
                }

                if (!acceptedCheckoutTerms) {
                    addToast('Aceite os Termos de adesão para criar a conta e continuar.', 'error');
                    setAuthLoading(false);
                    return;
                }

                if (recaptchaEnabled && !captchaToken) {
      addToast('Por favor, complete o desafio de segurança.', 'error');
                    setAuthLoading(false);
                    return;
                }

                const searchParams = new URLSearchParams(location.search);
                const referralCode = searchParams.get('ref') || searchParams.get('referral');

                const result = await authFlowService.register({
                    name: formData.name.trim(),
                    email: formData.email.trim(),
                    password: formData.password,
                    captchaToken,
                    referralCode
                });

                if (result.user) {
                    const { user, token } = result;
                    await login(user, token);
                    addToast('Conta criada com sucesso e login realizado!', 'success');
                    setStep('payment');
                } else {
                    addToast('Erro ao criar conta.', 'error');
                    if (recaptchaRef.current) recaptchaRef.current.reset();
                    setCaptchaToken(null);
                }

            } else {
                if (recaptchaEnabled && !captchaToken) {
        addToast('Por favor, complete o desafio de segurança.', 'error');
                    setAuthLoading(false);
                    return;
                }

                const result = await authFlowService.login({
                    email: formData.email,
                    password: formData.password,
                    captchaToken
                });

                if (result.require2FA) {
                    addToast('Esta conta exige 2FA. Entre pela tela de autenticação para concluir o login.', 'warning');
                    navigate('/auth?mode=login');
                } else if (result.user) {
                    const { user, token } = result;
                    await login(user, token);
                    addToast('Login realizado com sucesso!', 'success');
                    setStep('payment');
                } else {
                    addToast('Credenciais inválidas.', 'error');
                    if (recaptchaRef.current) recaptchaRef.current.reset();
                    setCaptchaToken(null);
                }
            }
        } catch (error) {
            console.error(error);
            addToast('Erro ao realizar autenticação.', 'error');
            if (recaptchaRef.current) recaptchaRef.current.reset();
            setCaptchaToken(null);
        } finally {
            setAuthLoading(false);
        }
    };

    const handleApplyCoupon = async () => {
        if (!couponCode) return;
        setIsApplyingCoupon(true);
        try {
            const response = await planService.validateCoupon(couponCode, couponValidationAmount, {
                planId: plan?.id,
                targetType: 'plan',
                targetId: plan?.id,
            });

            if (response.success && response.coupon) {
                setAppliedCoupon(response.coupon);
                setDiscountAmount(Number(response.coupon.discount_amount || 0));
                setAppliedCouponSource('manual');
                addToast('Cupom aplicado com sucesso!', 'success');
            } else {
                addToast(response.message || 'Cupom invalido ou expirado.', 'error');
                resetAppliedCoupon();
            }
        } catch (err) {
            addToast('Erro ao validar cupom.', 'error');
        } finally {
            setIsApplyingCoupon(false);
        }
    };

    const handleCheckoutRequirementFieldChange = (field: keyof typeof checkoutRequirementData, value: string) => {
        setCheckoutRequirementData((prev) => ({
            ...prev,
            [field]: value,
        }));
    };

    /**
     * Valida CPF no formato oficial brasileiro.
     * @since v1.0.0
     */
    const isValidCpf = (value: string) => {
        const digits = value.replace(/\D/g, '');
        if (digits.length !== 11) return false;
        if (/^(\d)\1{10}$/.test(digits)) return false;

        const calcCheckDigit = (base: string, factor: number) => {
            const total = base
                .split('')
                .reduce((sum, digit) => sum + (Number(digit) * factor--), 0);
            const result = 11 - (total % 11);
            return result > 9 ? 0 : result;
        };

        const digit1 = calcCheckDigit(digits.slice(0, 9), 10);
        const digit2 = calcCheckDigit(digits.slice(0, 10), 11);
        return digit1 === Number(digits[9]) && digit2 === Number(digits[10]);
    };

    /**
     * Regras mínimas para validar endereço antes de salvar.
     * @since v1.0.0
     */
    const validateCheckoutAddress = () => {
        const zipCodeDigits = checkoutRequirementData.zipCode.replace(/\D/g, '');
        const state = checkoutRequirementData.state.trim().toUpperCase();
        const street = checkoutRequirementData.street.trim();
        const number = checkoutRequirementData.number.trim();
        const neighborhood = checkoutRequirementData.neighborhood.trim();
        const city = checkoutRequirementData.city.trim();

        if (!isValidCpf(checkoutRequirementData.cpf)) {
            return { valid: false, message: 'CPF inválido. Verifique e tente novamente.' };
        }
        if (zipCodeDigits.length !== 8) {
            return { valid: false, message: 'CEP inválido. Informe um CEP com 8 dígitos.' };
        }
        if (street.length < 3) {
            return { valid: false, message: 'Logradouro inválido. Informe um endereço válido.' };
        }
        if (number.length < 1 || !/[0-9a-zA-Z]/.test(number)) {
            return { valid: false, message: 'Número inválido. Informe um número de endereço válido.' };
        }
        if (neighborhood.length < 2) {
            return { valid: false, message: 'Bairro inválido. Informe um bairro válido.' };
        }
        if (city.length < 2) {
            return { valid: false, message: 'Cidade inválida. Informe uma cidade válida.' };
        }
        if (!/^[A-Z]{2}$/.test(state)) {
            return { valid: false, message: 'UF inválida. Use a sigla com 2 letras (ex.: SP).' };
        }
        return { valid: true as const };
    };

    const handleSaveCheckoutRequirements = async () => {
        if (!currentUser) return;

        const requiredFields = [
            ['name', checkoutRequirementData.name],
            ['cpf', checkoutRequirementData.cpf],
            ['zipCode', checkoutRequirementData.zipCode],
            ['street', checkoutRequirementData.street],
            ['number', checkoutRequirementData.number],
            ['neighborhood', checkoutRequirementData.neighborhood],
            ['city', checkoutRequirementData.city],
            ['state', checkoutRequirementData.state],
        ] as const;

        const missing = requiredFields.find(([, value]) => !String(value || '').trim());
        if (missing) {
            addToast('Preencha todos os dados obrigatorios para concluir a compra.', 'warning');
            return;
        }

        const addressValidation = validateCheckoutAddress();
        if (!addressValidation.valid) {
            addToast(addressValidation.message, 'warning');
            return;
        }

        setIsSavingCheckoutRequirements(true);
        try {
            await updateUser({
                name: checkoutRequirementData.name.trim(),
                cpf: checkoutRequirementData.cpf.replace(/\D/g, ''),
                address: {
                    zipCode: checkoutRequirementData.zipCode.replace(/\D/g, ''),
                    street: checkoutRequirementData.street.trim(),
                    number: checkoutRequirementData.number.trim(),
                    complement: checkoutRequirementData.complement.trim(),
                    neighborhood: checkoutRequirementData.neighborhood.trim(),
                    city: checkoutRequirementData.city.trim(),
                    state: checkoutRequirementData.state.trim().toUpperCase(),
                },
            });

            await refreshUser();
      addToast('Perfil atualizado. Agora você já pode concluir a compra.', 'success');
        } catch (error) {
            console.error('Failed to update checkout requirements', error);
        } finally {
            setIsSavingCheckoutRequirements(false);
        }
    };

    const handleResendConfirmation = async () => {
        if (!currentUser?.email) return;

        setIsResendingConfirmation(true);
        try {
            const message = await authFlowService.resendConfirmation(currentUser.email);
      addToast(message || 'E-mail de confirmação reenviado com sucesso.', 'success');
        } catch (error: any) {
      addToast(error.message || 'Erro ao reenviar o e-mail de confirmação.', 'error');
        } finally {
            setIsResendingConfirmation(false);
        }
    };

    const handlePayment = async () => {
        if (!plan || !currentUser) return;
        if (!ensureCheckoutRequirements()) return;

        if (isStripeInternalCheckout) {
      addToast('Use o formulário Stripe abaixo para concluir a assinatura.', 'info');
            return;
        }

        setProcessing(true);
        try {
            const response = await planService.createStripeCheckoutSession({
                plan_id: plan.id,
                auto_renew: autoRenew,
                coupon_code: appliedCoupon?.code || undefined,
                billing_mode: stripeBillingMode,
                installment_count: selectedStripeInstallmentCount,
            });

            const redirectUrl = response?.data?.url || response?.url || response?.data?.redirect_url;
            if (!response?.success || !redirectUrl) {
        throw new Error(response?.message || 'Não foi possível iniciar o checkout Stripe.');
            }

            window.location.href = redirectUrl;
        } catch (error: any) {
            console.error('Stripe checkout error:', error);
            const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message || 'Erro ao iniciar o checkout Stripe.';
            addToast(errorMsg, 'error');
        } finally {
            setProcessing(false);
        }
    };

    const handleStripeInternalPayment = async (paymentMethodId: string) => {
        if (!plan || !currentUser) return;
        if (!ensureCheckoutRequirements()) return;

        setProcessing(true);
        try {
            const response = await planService.createStripeSubscription({
                plan_id: plan.id,
                auto_renew: autoRenew,
                coupon_code: appliedCoupon?.code || undefined,
                payment_method_id: paymentMethodId,
                save_card: saveCard || stripeRequiresSavedCard,
                billing_mode: stripeBillingMode,
                installment_count: selectedStripeInstallmentCount,
            });

            if (!response?.success) {
      throw new Error(response?.message || 'Não foi possível iniciar a assinatura Stripe.');
            }

            const payload = response?.data || response;
            setPendingStripeSubscriptionId(payload?.subscription_id || null);
            setPendingStripePaymentMethodId(paymentMethodId);

            return {
                clientSecret: payload?.client_secret,
                status: payload?.payment_intent_status,
                confirmationType: payload?.confirmation_type || 'payment',
                subscriptionId: payload?.subscription_id || null,
                paymentMethodId,
                paymentIntentId: payload?.payment_intent_id || null,
                saveCard: payload?.save_card ?? (saveCard || stripeRequiresSavedCard),
            };
        } catch (error: any) {
            console.error('Stripe internal checkout error:', error);
            const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message || 'Erro ao processar assinatura Stripe.';
            addToast(errorMsg, 'error');
            return undefined;
        } finally {
            setProcessing(false);
        }
    };

    const finalizeStripeInternalCheckout = async (options?: {
        subscriptionId?: string | null;
        paymentMethodId?: string | null;
        paymentIntentId?: string | null;
        savedCardId?: string | null;
        saveCard?: boolean;
    }) => {
        if (!plan) return;

        const subscriptionId = options?.subscriptionId || pendingStripeSubscriptionId;
        if (!subscriptionId) {
      throw new Error('A assinatura Stripe não retornou um identificador para a confirmação final.');
        }

        const resolvedSaveCard = options?.saveCard ?? (saveCard || stripeRequiresSavedCard);

        const response = await planService.finalizeStripeSubscription({
            subscription_id: subscriptionId,
            plan_id: plan.id,
            auto_renew: autoRenew,
            payment_method_id: options?.paymentMethodId || pendingStripePaymentMethodId || undefined,
            payment_intent_id: options?.paymentIntentId || undefined,
            saved_card_id: options?.savedCardId || undefined,
            save_card: resolvedSaveCard,
        });

        if (!response?.success) {
      throw new Error(response?.message || 'Não foi possível finalizar a assinatura Stripe.');
        }

        const payload = response?.data || response;
        await refreshUser();
        await loadSavedCards();

        setPendingStripeSubscriptionId(null);
        setPendingStripePaymentMethodId(null);

        if (payload?.card_saved && !options?.savedCardId) {
        addToast('Cartão salvo com sucesso para compras futuras.', 'success');
        }

        if (payload?.card_save_warning) {
            addToast(payload.card_save_warning, 'warning');
        }

        if (payload?.approved === false) {
                addToast('O pagamento foi bloqueado pela validacao antifraude da Stripe.', 'error');
            return;
        }

        if (payload?.access_granted === false) {
            addToast('Pagamento confirmado. Estamos concluindo a sincronizacao final da assinatura com a Stripe.', 'info');
            return;
        }

        setStep('success');
    };

    const handleStripeSavedCardPayment = async ({ stripe, cvcElement }: { stripe: any; cvcElement: any }) => {
        if (!plan || !currentUser || !selectedStripeCard) {
      throw new Error('Selecione um cartão salvo para continuar.');
        }
        if (!ensureCheckoutRequirements()) {
            throw new Error('Complete seu perfil e confirme o e-mail antes de concluir a compra.');
        }

        setProcessing(true);
        try {
            const response = await planService.createStripeSubscription({
                plan_id: plan.id,
                auto_renew: autoRenew,
                coupon_code: appliedCoupon?.code || undefined,
                saved_card_id: selectedStripeCard.id,
                save_card: true,
                billing_mode: stripeBillingMode,
                installment_count: selectedStripeInstallmentCount,
            });

            if (!response?.success) {
      throw new Error(response?.message || 'Não foi possível iniciar a cobrança com o cartão salvo.');
            }

            const payload = response?.data || response;
            const savedPaymentMethodId = selectedStripeCard.stripe_payment_method_id || null;

            if (payload?.client_secret) {
                if (!savedPaymentMethodId) {
      throw new Error('O cartão salvo selecionado não possui um método de pagamento Stripe válido.');
                }

                const confirmation =
                    payload?.confirmation_type === 'setup'
                        ? await stripe.confirmCardSetup(payload.client_secret, {
                            payment_method: savedPaymentMethodId,
                        })
                        : await stripe.confirmCardPayment(payload.client_secret, {
                            payment_method: savedPaymentMethodId,
                            payment_method_options: {
                                card: {
                                    cvc: cvcElement,
                                },
                            },
                        });

                if (confirmation.error) {
      throw new Error(confirmation.error.message || 'Não foi possível confirmar o código de segurança do cartão salvo.');
                }

                await finalizeStripeInternalCheckout({
                    subscriptionId: payload?.subscription_id || null,
                    paymentMethodId: savedPaymentMethodId,
                    paymentIntentId: confirmation.paymentIntent?.id || null,
                    savedCardId: selectedStripeCard.id,
                    saveCard: true,
                });
            } else {
                await finalizeStripeInternalCheckout({
                    subscriptionId: payload?.subscription_id || null,
                    paymentMethodId: savedPaymentMethodId,
                    savedCardId: selectedStripeCard.id,
                    saveCard: true,
                });
            }
        } catch (error: any) {
            console.error('Stripe saved card checkout error:', error);
    const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message || 'Erro ao processar o cartão salvo.';
            addToast(errorMsg, 'error');
            throw error;
        } finally {
            setProcessing(false);
        }
    };

    const planDisplayLabel = useMemo(() => {
        if (!plan) return '';
        const fallbackName = plan.name
            .replace(' - Mensal', '')
            .replace(' - Trimestral', '')
            .replace(' - Anual', '');

        return getConfiguredPlanDisplayName(plan.name, systemSettings.planDetails, fallbackName);
    }, [plan, systemSettings.planDetails]);

    const displayName = useMemo(() => planDisplayLabel.toUpperCase(), [planDisplayLabel]);

    const billingCycle = useMemo(() => {
        if (!plan) return '';
        if (plan.interval_unit === 'year') return 'Anual';
        if (plan.interval_unit === 'month' && plan.interval_count === 3) return 'Trimestral';
        return 'Mensal';
    }, [plan]);

    const nextRenewalDate = useMemo(() => {
        if (!plan) return null;
        const date = new Date();
        if (plan.interval_unit === 'year') {
            date.setFullYear(date.getFullYear() + 1);
        } else if (plan.interval_unit === 'month') {
            date.setMonth(date.getMonth() + (plan.interval_count || 1));
        }
        return date.toLocaleDateString('pt-BR');
    }, [plan]);

    const maxInstallments = useMemo(() => {
        if (!plan) return 1;
        const unit = plan.interval_unit?.toLowerCase();
        const name = plan.name?.toLowerCase() || '';
        if (unit === 'year' || name.includes('anual')) return 12;
        if ((unit === 'month' && plan.interval_count === 3) || name.includes('trimestral')) return 3;
        return 1;
    }, [plan]);

    const supportsStripeBillingChoices = isStripeProvider && maxInstallments > 1;
    const selectedStripeInstallmentCount = useMemo(() => {
        if (!supportsStripeBillingChoices) return 1;
        const parsedInstallments = Number.parseInt(paymentData.installments, 10);
        if (!Number.isFinite(parsedInstallments) || parsedInstallments <= 1) {
            return 1;
        }

        return Math.min(maxInstallments, parsedInstallments);
    }, [supportsStripeBillingChoices, paymentData.installments, maxInstallments]);

    useEffect(() => {
        setStripeBillingMode(selectedStripeInstallmentCount > 1 ? 'term_recurring' : 'single_installment');
    }, [selectedStripeInstallmentCount]);

    useEffect(() => {
        if (!currentUser) return;

        setCheckoutRequirementData({
            name: currentUser.name || '',
            cpf: currentUser.cpf || '',
            zipCode: currentUser.address?.zipCode || '',
            street: currentUser.address?.street || '',
            number: currentUser.address?.number || '',
            complement: currentUser.address?.complement || '',
            neighborhood: currentUser.address?.neighborhood || '',
            city: currentUser.address?.city || '',
            state: currentUser.address?.state || '',
        });
    }, [currentUser?.id, currentUser?.name, currentUser?.cpf, currentUser?.address]);

    const getMissingCheckoutRequirements = () => {
        if (!currentUser) return ['login'];

        const missing: string[] = [];
        const data = {
            name: currentUser.name,
            cpf: currentUser.cpf,
            zipCode: currentUser.address?.zipCode,
            street: currentUser.address?.street,
            number: currentUser.address?.number,
            neighborhood: currentUser.address?.neighborhood,
            city: currentUser.address?.city,
            state: currentUser.address?.state,
        };

        Object.entries(data).forEach(([key, value]) => {
            if (!String(value || '').trim()) {
                missing.push(key);
            }
        });

        if (!currentUser.emailVerified) {
            missing.push('emailVerified');
        }

        return missing;
    };

    const ensureCheckoutRequirements = () => {
        const missing = getMissingCheckoutRequirements();
        if (missing.length === 0) {
            return true;
        }

        setShowCheckoutRequirementsModal(true);
        addToast('Antes de concluir a compra, complete seu perfil e confirme o e-mail.', 'warning');
        return false;
    };

    const checkoutSubtotal = Number(checkoutBaseOffer?.originalCycleAmount || plan?.price || 0);
    const checkoutDiscountAmount = appliedCoupon ? Math.max(0, Number(discountAmount || 0)) : 0;
    const checkoutCouponSavingsAmount = Math.max(
        0,
        roundCurrency(
            Number(checkoutOffer?.originalCycleAmount || checkoutSubtotal)
            - Number(checkoutOffer?.discountedCycleAmount || checkoutSubtotal),
        ),
    );
    const checkoutResidualCreditAmount = Math.max(0, roundCurrency(Number(proRatedCredit || 0)));
    const checkoutDiscountedCycleAmount = Number(checkoutOffer?.discountedCycleAmount || Math.max(0, checkoutSubtotal - checkoutDiscountAmount));
    const checkoutFinalCycleAmount = Math.max(0, roundCurrency(checkoutDiscountedCycleAmount - checkoutResidualCreditAmount));
    const activePlanBenefits = useMemo(
        () => getActivePlanBenefits(plan, systemSettings.planDetails),
        [plan, systemSettings.planDetails],
    );
    const displayedPlanBenefits = activePlanBenefits.slice(0, 8);

    const selectedInstallment = useMemo(() => {
        if (!plan) {
            return {
                installments: 1,
                first_charge_amount: 0,
                installment_amount: 0,
                total_amount: 0,
                first_charge_discount_amount: 0,
            };
        }
        if (isStripeProvider) {
            if (supportsStripeBillingChoices && selectedStripeInstallmentCount > 1) {
                return resolveStripeTermAmounts(checkoutFinalCycleAmount, selectedStripeInstallmentCount);
            }

            return resolveStripeTermAmounts(checkoutFinalCycleAmount, 1);
        }
        const installmentsNumber = Number(paymentData.installments) || 1;

        if (isRecurring) {
            const amount = roundCurrency(checkoutFinalCycleAmount / maxInstallments);
            return {
                installments: 1,
                first_charge_amount: amount,
                installment_amount: amount,
                total_amount: amount,
                first_charge_discount_amount: 0,
            };
        }

        const marketplaceOpt = installmentOptions.find(
            (opt: any) => Number(opt.installments) === installmentsNumber
        );

        if (marketplaceOpt) {
            const marketplaceTotal = marketplaceOpt.total_amount ?? (marketplaceOpt.installment_amount * marketplaceOpt.installments);
            const ratio = Number(plan.price || 0) > 0 ? checkoutFinalCycleAmount / Number(plan.price || 0) : 0;
            const adjustedTotal = roundCurrency(Number(marketplaceTotal || 0) * ratio);
            return {
                installments: marketplaceOpt.installments,
                first_charge_amount: roundCurrency(adjustedTotal / Number(marketplaceOpt.installments || 1)),
                installment_amount: roundCurrency(adjustedTotal / Number(marketplaceOpt.installments || 1)),
                total_amount: adjustedTotal,
                first_charge_discount_amount: 0,
            };
        }

        const rate = 0.0299; 
        const amount = installmentsNumber === 1
            ? checkoutFinalCycleAmount
            : (checkoutFinalCycleAmount * rate) / (1 - Math.pow(1 + rate, -installmentsNumber));

        return {
            installments: installmentsNumber,
            first_charge_amount: roundCurrency(amount),
            installment_amount: roundCurrency(amount),
            total_amount: roundCurrency(amount * installmentsNumber),
            first_charge_discount_amount: 0,
        };
    }, [plan, installmentOptions, paymentData.installments, isRecurring, isStripeProvider, maxInstallments, supportsStripeBillingChoices, selectedStripeInstallmentCount, checkoutFinalCycleAmount]);

    const monetaryTotals = useMemo(() => {
        if (!plan) return { firstCharge: 0, totalDue: 0, contractTotal: 0 };
        const baseAmount = selectedInstallment.first_charge_amount ?? selectedInstallment.installment_amount;
        const totalDue = Math.max(0, baseAmount);
        return { firstCharge: baseAmount, totalDue, contractTotal: selectedInstallment.total_amount };
    }, [plan, selectedInstallment.first_charge_amount, selectedInstallment.installment_amount, selectedInstallment.total_amount]);

    const paymentProviderLabel = 'Stripe';
  const selectedMethodLabel = 'Cartão';
    const renewalLabel = autoRenew ? 'Automática' : 'Manual';
    const paymentActionLabel = isStripeProvider
      ? (isStripeInternalCheckout ? 'Concluir assinatura com segurança' : 'Continuar para pagamento')
        : isRecurring
            ? 'Ativar assinatura'
            : 'Pagar agora';
    const processingLabel = isStripeProvider
        ? (isStripeInternalCheckout ? 'Processando assinatura Stripe...' : 'Abrindo checkout Stripe...')
    : 'Processando segurança...';

    const checkoutBillingLabel = isStripeProvider
        ? (supportsStripeBillingChoices && selectedStripeInstallmentCount > 1
            ? `${selectedInstallment.installments}x de ${formatCurrency(monetaryTotals.totalDue)}`
            : `1x de ${formatCurrency(monetaryTotals.totalDue)}`)
        : (!isRecurring && selectedInstallment.installments > 1
            ? `${selectedInstallment.installments}x de R$ ${selectedInstallment.installment_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
            : `1x de R$ ${Number(monetaryTotals.firstCharge || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);

    const billingCycleSuffix = billingCycle.toLowerCase().includes('mens')
        ? '/mes'
        : billingCycle.toLowerCase().includes('anual')
            ? '/ano'
            : billingCycle.toLowerCase().includes('trimes')
                ? '/trimestre'
                : '/ciclo';

    const checkoutPlanHeroPriceLabel = `${formatCurrency(checkoutFinalCycleAmount)} ${billingCycleSuffix}`;

    const checkoutDueLabel = formatCurrency(monetaryTotals.totalDue);
    const siteName = systemSettings?.siteName || systemSettings?.appName || 'ConcursoMestre';
    const checkoutPaymentBreakdownLabel = selectedInstallment.installments > 1
        ? `${selectedInstallment.installments}x de ${formatCurrency(monetaryTotals.totalDue)}. TOTAL: ${formatCurrency(monetaryTotals.contractTotal)}.`
        : `COBRANÇA ÚNICA. TOTAL: ${formatCurrency(monetaryTotals.contractTotal || monetaryTotals.totalDue)}.`;
    const checkoutPaymentProtectionLabel = 'Pagamento protegido e acesso liberado assim que aprovado.';

    const checkoutInstallmentOptions = useMemo(() => {
        if (!supportsStripeBillingChoices) {
            return [
                {
                    value: '1',
                    label: `1x de ${formatCurrency(checkoutFinalCycleAmount)} sem juros`,
                },
            ];
        }

        return Array.from({ length: maxInstallments }, (_, index) => {
            const installmentCount = index + 1;
            const installmentPreview = resolveStripeTermAmounts(checkoutFinalCycleAmount, installmentCount);
            return {
                value: String(installmentCount),
                label: installmentCount > 1
                    ? `${installmentCount}x de ${formatCurrency(installmentPreview.installment_amount)} sem juros`
                    : `1x de ${formatCurrency(installmentPreview.first_charge_amount)} sem juros`,
            };
        });
    }, [checkoutFinalCycleAmount, maxInstallments, supportsStripeBillingChoices]);

    const nextRenewalSummaryLabel = autoRenew && nextRenewalDate
      ? nextRenewalDate
      : 'Manual';

    const checkoutLegalNotice = (
        <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[11px] font-semibold leading-relaxed text-slate-500 dark:border-slate-800 dark:bg-[#0f1020] dark:text-slate-400">
      Ao realizar o pagamento, você aceita os{' '}
            <Link
                to="/checkout/termos-de-adesao"
                target="_blank"
                rel="noopener noreferrer"
                className="font-black text-indigo-600 underline decoration-indigo-300 underline-offset-4 transition-colors hover:text-indigo-700 dark:text-indigo-400"
            >
                            Termos de adesão
            </Link>{' '}
      do {siteName}
        </p>
    );

    const renderSuccessStep = () => (
        <div className="overflow-hidden rounded-[2.25rem] border border-slate-200 bg-white shadow-xl shadow-slate-200/60 dark:border-slate-800 dark:bg-[#1a1c2e] dark:shadow-none">
            <div className="relative overflow-hidden bg-slate-950 px-8 py-10 text-center text-white md:px-12">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.28),transparent_36%)]" />
                <div className="relative z-10">
                    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.75rem] bg-emerald-500 text-white shadow-2xl shadow-emerald-500/30">
                        <CheckCircle2 size={40} />
                    </div>
                    <div className="mt-6 space-y-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-200">Pagamento aprovado</p>
                        <h2 className="text-3xl font-black leading-tight tracking-tight md:text-4xl">Parabéns pela aquisição</h2>
                        <p className="mx-auto max-w-xl text-base font-semibold leading-relaxed text-slate-300">
          O plano <span className="font-black text-white">{displayName}</span> foi confirmado e seu acesso já está pronto para uso.
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid border-b border-slate-100 dark:border-slate-800 md:grid-cols-3">
                {[
                    ['Plano', displayName, billingCycle],
      ['Cobrança confirmada', formatCurrency(monetaryTotals.totalDue), checkoutBillingLabel],
      ['Próximo passo', 'Minha assinatura', 'Status, transações e renovação.'],
                ].map(([label, value, hint]) => (
                    <div key={label} className="border-t border-slate-100 px-6 py-5 first:border-t-0 dark:border-slate-800 md:border-l md:border-t-0 md:first:border-l-0">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">{label}</p>
                        <p className="mt-3 text-lg font-black leading-none text-slate-900 dark:text-white">{value}</p>
                        <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">{hint}</p>
                    </div>
                ))}
            </div>

            <div className="px-8 py-8 text-center md:px-12">
                <button
                    onClick={() => navigate('/profile/billing')}
                    className="inline-flex h-14 items-center justify-center gap-3 rounded-2xl bg-indigo-600 px-8 text-[10px] font-black uppercase tracking-[0.2em] text-white transition-all hover:bg-indigo-700"
                >
                    Ir para minha assinatura
                    <ArrowRight size={16} />
                </button>
                <p className="mt-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                                Redirecionamento automático em {countdown} segundos
                </p>
            </div>
        </div>
    );

    const { handleSummaryPaymentAction, summaryConfirmLabel } = useCheckoutSummaryAction({
        isStripeInternalCheckout,
        isUsingStripeSavedCard,
        paymentActionLabel,
        handlePayment,
    });

    if (loading) return (
        <div className="min-h-screen bg-slate-50 dark:bg-[#0f1020] flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 dark:border-indigo-400"></div>
                <p className="text-xs font-black text-slate-500 uppercase tracking-widest animate-pulse">Preparando Checkout Seguro...</p>
            </div>
        </div>
    );

    if (!plan) return null;

    const handleBack = () => {
        if (step === 'payment') {
            if (currentUser) navigate(-1);
            else setStep('identification');
        } else if (step === 'success') {
            navigate('/profile/billing');
        } else {
            navigate(-1);
        }
    };

    const handleUseDifferentAccount = async () => {
        setAuthLoading(true);
        try {
            await logout();
            setAuthMode('login');
            setFormData({
                name: '',
                email: '',
                password: '',
                confirmPassword: '',
            });
            setAcceptedCheckoutTerms(false);
            setStep('identification');
        } catch (error: any) {
            addToast(error?.message || 'Não foi possível trocar de conta agora.', 'error');
        } finally {
            setAuthLoading(false);
        }
    };

    return (
        <div className={`min-h-[100dvh] overflow-x-hidden bg-zinc-50 px-3 py-6 transition-colors duration-500 dark:bg-[#0f1020] sm:px-4 md:py-10 ${showCheckoutCountdown ? 'pb-44 md:pb-52' : ''}`}>
            <style>{`
                #securityCodeSecureField_container {
                    width: 100%;
                    height: 100%;
                    display: block;
                }

                #securityCodeSecureField_container iframe {
                    width: 100% !important;
                    height: 100% !important;
                    min-height: 56px;
                }
            `}</style>
            <div className="pointer-events-none fixed inset-x-0 top-0 hidden h-[240px] bg-[linear-gradient(to_bottom,rgba(255,255,255,0.88),transparent)] dark:bg-[linear-gradient(to_bottom,rgba(15,16,32,0.92),transparent)] md:block" />
             
            <div className={`relative z-10 mx-auto ${step === 'payment' ? 'max-w-6xl' : 'max-w-7xl'}`}>
                <CheckoutHeader />
                {step !== 'success' ? (
                    <div className="mb-4">
                        <button
                            type="button"
                            onClick={handleBack}
                            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-950 dark:text-slate-300 dark:hover:text-slate-100"
                        >
                            <ArrowLeft size={16} />
                            Voltar
                        </button>
                    </div>
                ) : null}
                <CheckoutStepTracker step={step} />

                <div className="grid grid-cols-1 items-start gap-8">
                    <div className={`${step === 'success' ? 'mx-auto max-w-3xl' : ''} space-y-6 transition-all duration-700`}>
                        {step === 'identification' && (
                            <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl shadow-slate-200/60 animate-in zoom-in-95 duration-500 dark:border-slate-800 dark:bg-[#1a1c2e] dark:shadow-none">
                                <div className="grid min-h-[560px] lg:grid-cols-[0.92fr_1.08fr]">
                                    <div className="relative overflow-hidden bg-slate-950 p-7 text-white md:p-10">
                                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.38),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.24),transparent_34%)]" />
                                        <div className="relative z-10 flex h-full flex-col justify-between gap-10">
                                            <div className="space-y-5">
                                                <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-[9px] font-black uppercase tracking-[0.22em] text-indigo-100">
                                                    Plano selecionado
                                                </span>
                                                <div>
                    <p className="text-sm font-semibold text-slate-300">Você está a um passo de assinar</p>
                                                    <h2 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">{planDisplayLabel}</h2>
                                                </div>
                                                <div className="space-y-3">
                                                    {displayedPlanBenefits.slice(0, 5).map((benefit) => (
                                                        <div key={benefit} className="flex items-start gap-3">
                                                            <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-300" />
                                                            <span className="text-sm font-bold leading-relaxed text-slate-100">{benefit}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="grid gap-3 text-[11px] font-bold text-slate-200">
                                                <div className="flex items-center gap-3">
                                                    <ShieldCheck size={16} className="text-emerald-300" />
                                                    Pagamento seguro e dados protegidos
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <RotateCcw size={16} className="text-emerald-300" />
                                                    Reembolso em até 7 dias em caso de arrependimento
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-center p-6 md:p-8">
                                        <div className="w-full max-w-sm space-y-6">
                                            <div className="space-y-2">
                                                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"><User size={24} /></div>
                                                <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Identificação</h2>
                                                <p className="text-sm font-semibold leading-relaxed text-slate-500 dark:text-slate-400">Entre ou crie uma conta para vincular a assinatura ao seu perfil.</p>
                                            </div>

                                            {currentUser ? (
                                                <div className="space-y-3">
                                                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                                                        <div className="flex items-center gap-2.5">
                                                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                                                                <CheckCircle2 size={16} />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="text-[8px] font-black uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">Conta conectada</p>
                                                                <h3 className="mt-0.5 truncate text-sm font-black text-slate-900 dark:text-white">{currentUser.name || 'Usuário logado'}</h3>
                                                                <p className="truncate text-[11px] font-semibold text-slate-500 dark:text-slate-400">{currentUser.email}</p>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-[#0f1020]">
                                                        <p className="text-[11px] font-semibold leading-relaxed text-slate-600 dark:text-slate-300">
                                                            A assinatura será vinculada a esta conta. Dados de cobrança só serão solicitados se estiverem faltando no cadastro.
                                                        </p>
                                                    </div>

                                                    <button
                                                        type="button"
                                                        onClick={() => setStep('payment')}
                                                        className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 text-[10px] font-black uppercase tracking-widest text-white shadow-xl shadow-indigo-500/20 transition-all hover:bg-indigo-700 active:scale-[0.98]"
                                                    >
                                                        Continuar para pagamento
                                                        <ArrowRight size={18} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={handleUseDifferentAccount}
                                                        disabled={authLoading}
                                                        className="flex h-11 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white text-[10px] font-black uppercase tracking-widest text-slate-600 transition-all hover:border-indigo-200 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-800 dark:bg-[#121528] dark:text-slate-300"
                                                    >
                                                        Continuar com outra conta
                                                    </button>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="flex rounded-2xl bg-slate-100 p-1.5 dark:bg-[#0f1020]">
                                                        <button type="button" onClick={() => { setAuthMode('register'); setAcceptedCheckoutTerms(false); }} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${authMode === 'register' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Criar Conta</button>
                                                        <button type="button" onClick={() => setAuthMode('login')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${authMode === 'login' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Já tenho conta</button>
                                                    </div>

                                                    <form onSubmit={handleAuth} className="space-y-4">
                                                {authMode === 'register' && (
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nome Completo</label>
                                                        <div className="relative">
                                                            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                                            <input type="text" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full h-14 pl-12 pr-4 bg-slate-50 dark:bg-[#0f1020] border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-white font-bold outline-none focus:border-indigo-500 transition-all placeholder:text-slate-400" placeholder="Digite seu nome" />
                                                        </div>
                                                    </div>
                                                )}
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">E-mail</label>
                                                    <div className="relative">
                                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                                        <input type="email" required value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full h-14 pl-12 pr-4 bg-slate-50 dark:bg-[#0f1020] border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-white font-bold outline-none focus:border-indigo-500 transition-all placeholder:text-slate-400" placeholder="seu@email.com" />
                                                    </div>
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Senha</label>
                                                    <div className="relative">
                                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                                        <input type="password" required value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} className="w-full h-14 pl-12 pr-4 bg-slate-50 dark:bg-[#0f1020] border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-white font-bold outline-none focus:border-indigo-500 transition-all placeholder:text-slate-400" placeholder="********" />
                                                    </div>
                                                </div>
                                                {authMode === 'register' && (
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Confirmar Senha</label>
                                                        <div className="relative">
                                                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                                            <input type="password" required value={formData.confirmPassword} onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })} className="w-full h-14 pl-12 pr-4 bg-slate-50 dark:bg-[#0f1020] border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-white font-bold outline-none focus:border-indigo-500 transition-all placeholder:text-slate-400" placeholder="Repita sua senha" />
                                                        </div>
                                                    </div>
                                                )}
                                                {authMode === 'register' && (
                                                    <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold leading-relaxed text-slate-600 dark:border-slate-800 dark:bg-[#0f1020] dark:text-slate-300">
                                                        <input
                                                            type="checkbox"
                                                            checked={acceptedCheckoutTerms}
                                                            onChange={(e) => setAcceptedCheckoutTerms(e.target.checked)}
                                                            className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                                        />
                                                        <span>
                                                            Li e aceito os{' '}
                                                            <Link to="/checkout/termos-de-adesao" target="_blank" rel="noopener noreferrer" className="font-black text-indigo-600 underline decoration-indigo-300 underline-offset-4 transition-colors hover:text-indigo-700 dark:text-indigo-400">
                                                                Termos de adesão
                                                            </Link>
                                                            {' '}para criar minha conta e seguir com a assinatura.
                                                        </span>
                                                    </label>
                                                )}
                                                {recaptchaEnabled && <div className="flex justify-center py-2"><ReCAPTCHA ref={recaptchaRef} sitekey={systemSettings?.recaptchaSiteKey || ''} onChange={setCaptchaToken} theme={document.documentElement.classList.contains('dark') ? 'dark' : 'light'} /></div>}
                                                <button type="submit" disabled={authLoading} className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] rounded-2xl text-white font-black uppercase tracking-widest shadow-xl shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-70">
                                                    {authLoading ? <span className="animate-pulse">Aguarde...</span> : <>{authMode === 'register' ? 'Criar Minha Conta' : 'Acessar Minha Conta'} <ArrowRight size={18} /></>}
                                                </button>
                                                    </form>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {step === 'payment' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                                <CheckoutPaymentStage
                                    planName={planDisplayLabel}
                                    billingCycle={billingCycle}
                                    planBenefits={displayedPlanBenefits}
                                    subtotalLabel={formatCurrency(checkoutSubtotal)}
                                    couponDiscountLabel={checkoutCouponSavingsAmount > 0 ? formatCurrency(checkoutCouponSavingsAmount) : null}
                                    residualCreditDiscountLabel={checkoutResidualCreditAmount > 0 ? formatCurrency(checkoutResidualCreditAmount) : null}
                                    totalLabel={formatCurrency(monetaryTotals.contractTotal)}
                                    dueLabel={checkoutDueLabel}
                                    couponCode={couponCode}
                                    applyingCoupon={isApplyingCoupon}
                                    appliedCouponCode={appliedCoupon?.code || null}
                                    appliedCouponSource={appliedCouponSource}
                                    couponSavingsLabel={checkoutCouponSavingsAmount > 0 ? formatCurrency(checkoutCouponSavingsAmount) : null}
                                    autoRenew={autoRenew}
                                    saveCard={saveCard}
                                    stripeRequiresSavedCard={stripeRequiresSavedCard}
                                    isStripeInternalCheckout={isStripeInternalCheckout}
                                    isLoadingStripeCards={isLoadingStripeCards}
                                    stripeCards={stripeCards}
                                    selectedStripeCardId={selectedStripeCardId}
                                    selectedStripeCard={selectedStripeCard}
                                    stripePublishableKey={STRIPE_PUBLISHABLE_KEY}
                                    currentUserName={currentUser?.name}
                                    currentUserEmail={currentUser?.email}
                                    currentUserCpf={currentUser?.cpf}
                                    currentUserAddress={currentUser?.address}
                                    emailVerified={currentUser?.emailVerified}
                                    hasMissingRequirements={currentUser ? getMissingCheckoutRequirements().length > 0 : true}
                                    nextRenewalLabel={nextRenewalSummaryLabel}
                                    paymentBreakdownLabel={checkoutPaymentBreakdownLabel}
                                    paymentProtectionLabel={checkoutPaymentProtectionLabel}
                                    installmentOptions={checkoutInstallmentOptions}
                                    selectedInstallmentValue={paymentData.installments}
                                    processing={processing}
                                    legalNotice={checkoutLegalNotice}
                                    pixCapabilityStatus={stripePixCapability?.status}
                                    pixCapabilityMessage={stripePixCapability?.message}
                                    enabledPaymentMethodIds={checkoutEnabledPaymentMethodIds}
                                    onCouponCodeChange={setCouponCode}
                                    onApplyCoupon={handleApplyCoupon}
                                    onRemoveCoupon={resetAppliedCoupon}
                                    onAutoRenewChange={(enabled) => {
                                        setAutoRenew(enabled);
                                        if (enabled && !isUsingStripeSavedCard) {
                                            setSaveCard(true);
                                        }
                                    }}
                                    onSaveCardChange={setSaveCard}
                                    onSelectSavedCard={(cardId) => {
                                        setSelectedStripeCardId(cardId);
                                        setSaveCard(false);
                                    }}
                                    onSelectNewCard={() => setSelectedStripeCardId(null)}
                                    onConfirmSavedCard={handleStripeSavedCardPayment}
                                    onPaymentMethodCreated={handleStripeInternalPayment}
                                    onPaymentFinalized={(stripeStep) => finalizeStripeInternalCheckout({
                                        subscriptionId: stripeStep?.subscriptionId || null,
                                        paymentMethodId: stripeStep?.paymentMethodId || null,
                                        paymentIntentId: stripeStep?.paymentIntentId || null,
                                        saveCard: stripeStep?.saveCard,
                                    })}
                                    onConfirmClick={handleSummaryPaymentAction}
                                    onInstallmentChange={(value) => setPaymentData((prev) => ({ ...prev, installments: value }))}
                                    onEditBillingInfo={() => setShowCheckoutRequirementsModal(true)}
                                    confirmLabel={summaryConfirmLabel}
                                    processingLabel={processingLabel}
                                />
                            </div>
                        )}
                        {step === 'success' && renderSuccessStep()}
                    </div>

                </div>
            </div>

            {showDowngradeModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-sm">
                    <div className="bg-slate-900 w-full max-w-lg rounded-3xl p-8 border border-slate-800 text-center space-y-6">
                        <div className="w-20 h-20 bg-amber-500/10 rounded-2xl flex items-center justify-center mx-auto"><AlertTriangle size={40} className="text-amber-500" /></div>
                        <h3 className="text-xl font-black text-white uppercase tracking-tight">Aviso de Downgrade</h3>
                    <p className="text-sm text-slate-400 leading-relaxed">Você está mudando para um plano inferior. Benefícios exclusivos do seu plano atual (<span className="text-indigo-400 font-bold">{currentUser?.subscription?.plan?.name}</span>) serão perdidos na próxima renovação.</p>
                        <button onClick={() => setShowDowngradeModal(false)} className="w-full py-4 bg-white text-slate-900 rounded-xl font-black uppercase tracking-widest">Entendi e quero continuar</button>
                    </div>
                </div>
            )}

            {showCheckoutRequirementsModal && currentUser && (
                <div className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto p-4 md:items-center">
                    <div
                        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
                        onClick={() => setShowCheckoutRequirementsModal(false)}
                    />
                    <div className="relative z-10 my-auto flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-[#1a1c2e] md:p-8">
                        <div className="flex flex-none flex-col gap-3 border-b border-slate-100 pb-5 dark:border-slate-800 md:flex-row md:items-start md:justify-between">
                            <div className="space-y-2">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Checkout seguro</p>
                                <h3 className="text-2xl font-black text-slate-900 dark:text-white">Complete seu cadastro para pagar</h3>
                                <p className="max-w-2xl text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                    Antes de concluir a compra, precisamos dos seus dados de cobrança e de uma conta com e-mail confirmado.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowCheckoutRequirementsModal(false)}
                                className="self-start rounded-xl p-2 text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                            >
                                <XCircle size={18} />
                            </button>
                        </div>

                        <div className="mt-6 flex-1 space-y-6 overflow-y-auto pr-1">
                            <div className={`rounded-[1.5rem] border px-5 py-4 ${currentUser.emailVerified ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-500/10' : 'border-amber-200 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/10'}`}>
                                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Confirmação de e-mail</p>
                                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                            {currentUser.emailVerified ? 'Seu e-mail já está confirmado.' : 'Confirme seu e-mail para liberar o pagamento.'}
                                        </p>
                                        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{currentUser.email}</p>
                                    </div>
                                    <div className="flex flex-wrap gap-3">
                                        {!currentUser.emailVerified && (
                                            <button
                                                type="button"
                                                onClick={handleResendConfirmation}
                                                disabled={isResendingConfirmation}
                                                className="h-11 rounded-xl border border-slate-200 px-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-600 transition-all hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                                            >
                                                {isResendingConfirmation ? 'Enviando...' : 'Reenviar e-mail'}
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                await refreshUser();
                                            }}
                                            className="h-11 rounded-xl bg-slate-900 px-4 text-[10px] font-black uppercase tracking-[0.18em] text-white transition-all hover:bg-slate-800 dark:bg-indigo-600"
                                        >
                                            Já confirmei
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Nome completo <span className="text-rose-500">*</span></label>
                                    <input
                                        type="text"
                                        value={checkoutRequirementData.name}
                                        onChange={(event) => handleCheckoutRequirementFieldChange('name', event.target.value)}
                                        className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none transition-all focus:border-indigo-500 dark:border-slate-700 dark:bg-[#0f1020] dark:text-white"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">CPF <span className="text-rose-500">*</span></label>
                                    <input
                                        type="text"
                                        value={checkoutRequirementData.cpf}
                                        onChange={(event) => handleCheckoutRequirementFieldChange('cpf', event.target.value)}
                                        className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none transition-all focus:border-indigo-500 dark:border-slate-700 dark:bg-[#0f1020] dark:text-white"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">CEP <span className="text-rose-500">*</span></label>
                                    <input
                                        type="text"
                                        value={checkoutRequirementData.zipCode}
                                        onChange={(event) => handleCheckoutRequirementFieldChange('zipCode', event.target.value)}
                                        className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none transition-all focus:border-indigo-500 dark:border-slate-700 dark:bg-[#0f1020] dark:text-white"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Logradouro <span className="text-rose-500">*</span></label>
                                    <input
                                        type="text"
                                        value={checkoutRequirementData.street}
                                        onChange={(event) => handleCheckoutRequirementFieldChange('street', event.target.value)}
                                        className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none transition-all focus:border-indigo-500 dark:border-slate-700 dark:bg-[#0f1020] dark:text-white"
                                    />
                                </div>
                                <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Número</label>
                                    <input
                                        type="text"
                                        value={checkoutRequirementData.number}
                                        onChange={(event) => handleCheckoutRequirementFieldChange('number', event.target.value)}
                                        className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none transition-all focus:border-indigo-500 dark:border-slate-700 dark:bg-[#0f1020] dark:text-white"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Complemento</label>
                                    <input
                                        type="text"
                                        value={checkoutRequirementData.complement}
                                        onChange={(event) => handleCheckoutRequirementFieldChange('complement', event.target.value)}
                                        className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none transition-all focus:border-indigo-500 dark:border-slate-700 dark:bg-[#0f1020] dark:text-white"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Bairro <span className="text-rose-500">*</span></label>
                                    <input
                                        type="text"
                                        value={checkoutRequirementData.neighborhood}
                                        onChange={(event) => handleCheckoutRequirementFieldChange('neighborhood', event.target.value)}
                                        className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none transition-all focus:border-indigo-500 dark:border-slate-700 dark:bg-[#0f1020] dark:text-white"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Cidade <span className="text-rose-500">*</span></label>
                                    <input
                                        type="text"
                                        value={checkoutRequirementData.city}
                                        onChange={(event) => handleCheckoutRequirementFieldChange('city', event.target.value)}
                                        className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none transition-all focus:border-indigo-500 dark:border-slate-700 dark:bg-[#0f1020] dark:text-white"
                                    />
                                </div>
                            </div>

                            <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                                <span className="text-rose-500">*</span> Campos obrigatórios.
                            </p>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">UF <span className="text-rose-500">*</span></label>
                                <input
                                    type="text"
                                    maxLength={2}
                                    value={checkoutRequirementData.state}
                                    onChange={(event) => handleCheckoutRequirementFieldChange('state', event.target.value.toUpperCase())}
                                    className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold uppercase text-slate-900 outline-none transition-all focus:border-indigo-500 dark:border-slate-700 dark:bg-[#0f1020] dark:text-white"
                                />
                            </div>
                        </div>

                        <div className="mt-6 flex flex-none flex-col gap-3 border-t border-slate-100 pt-6 dark:border-slate-800 sm:flex-row sm:justify-end">
                            <button
                                type="button"
                                onClick={() => setShowCheckoutRequirementsModal(false)}
                                className="h-12 rounded-2xl border border-slate-200 px-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 transition-all hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                                Fechar
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveCheckoutRequirements}
                                disabled={isSavingCheckoutRequirements}
                                className="h-12 rounded-2xl bg-indigo-600 px-5 text-[10px] font-black uppercase tracking-[0.2em] text-white transition-all hover:bg-indigo-700 disabled:opacity-60"
                            >
                                {isSavingCheckoutRequirements ? 'Salvando...' : 'Salvar e continuar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showCheckoutCountdown && (
                <div className="fixed inset-x-0 bottom-3 z-40 px-4">
                    <div className="mx-auto max-w-6xl">
                        <LimitedOfferCountdown enabled endsAt={limitedOfferEndsAt} />
                    </div>
                </div>
            )}
        </div>
    );
};

export default CheckoutPage;

