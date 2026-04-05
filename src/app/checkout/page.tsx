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

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@providers/AuthProvider';
import { useData } from '@providers/DataProvider';
import { useToast } from '@providers/ToastProvider';
import { planService } from '@services/plans';
import { Plan } from '@types';
import { authFlowService } from '@services/auth';
import { cardsService } from '@services/billing';
import { paymentsService } from '@services/payments';
import {
    CheckCircle2, ShieldCheck, ArrowRight, ArrowLeft, CreditCard,
    Lock, User, Mail, UserPlus, LogIn, ChevronRight, QrCode, FileText, Calendar, ToggleRight, ToggleLeft, AlertTriangle, XCircle,
    Award, Zap, Globe, Shield, Plus, History, Fingerprint
} from 'lucide-react';
import { getInstallments, getIssuers, getPaymentMethods, initMercadoPago } from '@mercadopago/sdk-react';
import ReCAPTCHA from 'react-google-recaptcha';
import StripeCardElementForm from './components/StripeCardElementForm';
import StripeSavedCardCvcForm from './components/StripeSavedCardCvcForm';

type CheckoutStep = 'identification' | 'payment' | 'success';
type AuthMode = 'login' | 'register';
type PaymentMethod = 'credit_card' | 'pix' | 'boleto';

declare global {
    interface Window {
        MercadoPago: any;
    }
}

const CheckoutPage: React.FC = () => {
    const { planId } = useParams<{ planId: string }>();
    const { currentUser, login, refreshUser, updateUser } = useAuth();
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
    const [authMode, setAuthMode] = useState<AuthMode>('register');
    const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('credit_card');
    const [autoRenew, setAutoRenew] = useState(true);
    const [saveCard, setSaveCard] = useState(false);
    const [isRecurring, setIsRecurring] = useState(false);
    const [countdown, setCountdown] = useState(10);

    // Auth Form State
    const [authLoading, setAuthLoading] = useState(false);
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
    const activePaymentProvider = (systemSettings?.paymentProvider || 'mercado_pago') as 'mercado_pago' | 'stripe';
    const isStripeProvider = activePaymentProvider === 'stripe';
    const stripeCheckoutMode = (systemSettings?.paymentCheckoutMode || 'internal') as 'internal' | 'redirect';
    const cardVaultProvider = (systemSettings?.cardVaultProvider || 'local') as 'local' | 'mercado_pago' | 'stripe';
    const isStripeInternalCheckout = isStripeProvider && stripeCheckoutMode === 'internal';
    const MP_PUBLIC_KEY = systemSettings?.mercadoPagoKey || 'TEST-1e38d560-c2b8-4a5c-8b12-bad17bb8a9ba';
    const STRIPE_PUBLISHABLE_KEY = systemSettings?.stripePublishableKey || systemSettings?.stripeKey || '';
    const savedCardCheckoutSupported = !/^TEST-/i.test(MP_PUBLIC_KEY || '');
    const savedCardCheckoutBlockedMessage = 'O Mercado Pago so aceita pagamento com cartao salvo neste fluxo usando credenciais de producao e, em homologacao, usuarios de teste. Com a chave TEST atual, use um cartao novo no checkout.';
    
    const [paymentData, setPaymentData] = useState({
        cardNumber: '',
        cardHolder: '',
        cardExpiry: '',
        cardCvv: '',
        cpf: '',
        payerName: '',
        installments: '1'
    });

    // Mercado Pago State
    const [installmentOptions, setInstallmentOptions] = useState<any[]>([]);
    const [paymentMethodId, setPaymentMethodId] = useState<string>('');
    const [issuerId, setIssuerId] = useState<string | null>(null);

    // Saved Cards State
    const [savedCards, setSavedCards] = useState<any[]>([]);
    const [isUsingSavedCard, setIsUsingSavedCard] = useState(false);
    const [selectedCard, setSelectedCard] = useState<any>(null);
    const [savedCardSecurityReady, setSavedCardSecurityReady] = useState(false);
    const [savedCardSecurityComplete, setSavedCardSecurityComplete] = useState(false);
    const [savedCardSecurityError, setSavedCardSecurityError] = useState<string | null>(null);
    const [stripeCards, setStripeCards] = useState<any[]>([]);
    const [isLoadingStripeCards, setIsLoadingStripeCards] = useState(false);
    const requiresSavedCard = isRecurring || (autoRenew && !isUsingSavedCard);
    const [selectedStripeCardId, setSelectedStripeCardId] = useState<string | null>(null);
    const [pendingStripeSubscriptionId, setPendingStripeSubscriptionId] = useState<string | null>(null);
    const [pendingStripePaymentMethodId, setPendingStripePaymentMethodId] = useState<string | null>(null);
    const savedCardMpRef = useRef<any>(null);
    const savedCardSecurityFieldRef = useRef<any>(null);
    const savedCardSecurityTouchedRef = useRef(false);

    const normalizePaymentMethodId = (value?: string | null): string => {
        if (!value) return '';

        const normalized = value.toString().trim().toLowerCase();
        const aliases: Record<string, string> = {
            mastercard: 'master',
            master: 'master',
            visa: 'visa',
            amex: 'amex',
            'american express': 'amex',
            americanexpress: 'amex',
            elo: 'elo',
            hipercard: 'hipercard',
            diners: 'diners',
            'diners club': 'diners',
            dinersclub: 'diners',
            discover: 'discover',
            jcb: 'jcb',
        };

        return aliases[normalized] || normalized;
    };

    const maskToken = (value?: string | null): string => {
        if (!value) return 'missing';
        if (value.length <= 8) return value;
        return `${value.slice(0, 4)}...${value.slice(-4)}`;
    };

    const logMercadoPagoDebug = (label: string, payload: Record<string, unknown>) => {
        if (!import.meta.env.DEV) return;
        console.info(`[MercadoPago] ${label}`, payload);
    };

    const selectedStripeCard = useMemo(() => {
        return stripeCards.find((card: any) => card.id === selectedStripeCardId) || null;
    }, [stripeCards, selectedStripeCardId]);

    const isUsingStripeSavedCard = isStripeProvider && Boolean(selectedStripeCard);
    const stripeRequiresSavedCard = isStripeProvider && autoRenew && !isUsingStripeSavedCard;

    useEffect(() => {
        if (!planId) {
            navigate('/plans');
            return;
        }
        loadPlan();
    }, [planId]);

    useEffect(() => {
        if (!isStripeProvider && MP_PUBLIC_KEY) {
            initMercadoPago(MP_PUBLIC_KEY, {
                locale: 'pt-BR',
                trackingDisabled: true,
                advancedFraudPrevention: true,
            });
        }
    }, [MP_PUBLIC_KEY, isStripeProvider]);

    useEffect(() => {
        const shouldMountSavedCardField =
            !isStripeProvider &&
            Boolean(MP_PUBLIC_KEY) &&
            selectedMethod === 'credit_card' &&
            isUsingSavedCard &&
            Boolean(selectedCard?.mp_card_id);

        setSavedCardSecurityReady(false);
        setSavedCardSecurityComplete(false);
        setSavedCardSecurityError(null);
        savedCardSecurityTouchedRef.current = false;

        if (savedCardSecurityFieldRef.current) {
            try {
                savedCardSecurityFieldRef.current.unmount();
            } catch (error) {
                console.warn('Failed to unmount saved card security field', error);
            }
            savedCardSecurityFieldRef.current = null;
        }

        if (!shouldMountSavedCardField) {
            return;
        }

        if (!window.MercadoPago) {
            setSavedCardSecurityError('O SDK do Mercado Pago ainda nÃ£o carregou. Atualize a pÃ¡gina e tente novamente.');
            return;
        }

        const mpInstance = new window.MercadoPago(MP_PUBLIC_KEY, {
            locale: 'pt-BR',
        });
        savedCardMpRef.current = mpInstance;

        const securityCodeField = mpInstance.fields.create('securityCode', {
            placeholder: '123',
            mode: 'mandatory',
            style: {
                color: '#0f172a',
                fontSize: '16px',
                fontWeight: '700',
                fontFamily: 'Inter, sans-serif',
                padding: '0',
                width: '100%',
            },
        });

        securityCodeField.on('ready', () => {
            setSavedCardSecurityError(null);
            setSavedCardSecurityReady(true);
            setSavedCardSecurityComplete(false);
            savedCardSecurityTouchedRef.current = false;
            window.setTimeout(() => {
                try {
                    securityCodeField.focus();
                } catch (error) {
                    console.warn('Failed to focus saved card security field', error);
                }
            }, 120);
        });

        securityCodeField.on('change', () => {
            savedCardSecurityTouchedRef.current = true;
        });

        securityCodeField.on('validityChange', ({ errorMessages }: any) => {
            const nextError = errorMessages?.[0]?.message || null;
            setSavedCardSecurityError(nextError);
            setSavedCardSecurityComplete(savedCardSecurityTouchedRef.current && !nextError);
        });

        securityCodeField.on('error', ({ error }: any) => {
            setSavedCardSecurityReady(false);
            setSavedCardSecurityComplete(false);
            setSavedCardSecurityError(error || 'NÃ£o foi possÃ­vel carregar o campo seguro do cartÃ£o salvo.');
        });

        securityCodeField.mount('saved-card-security-code-container');
        savedCardSecurityFieldRef.current = securityCodeField;

        return () => {
            try {
                securityCodeField.unmount();
            } catch (error) {
                console.warn('Failed to cleanup saved card security field', error);
            }
            if (savedCardSecurityFieldRef.current === securityCodeField) {
                savedCardSecurityFieldRef.current = null;
            }
        };
    }, [MP_PUBLIC_KEY, isStripeProvider, isUsingSavedCard, selectedCard?.id, selectedCard?.mp_card_id, selectedMethod]);

    useEffect(() => {
        if (selectedMethod !== 'credit_card' && isRecurring) {
            setIsRecurring(false);
        }
    }, [selectedMethod, isRecurring]);

    useEffect(() => {
        if (isStripeProvider && selectedMethod !== 'credit_card') {
            setSelectedMethod('credit_card');
        }
    }, [isStripeProvider, selectedMethod]);

    useEffect(() => {
        if (isStripeProvider) {
            setIsRecurring(false);
            setIsUsingSavedCard(false);
            setSelectedCard(null);
            setSelectedStripeCardId(null);
            setPendingStripeSubscriptionId(null);
            setPendingStripePaymentMethodId(null);
            setIssuerId(null);
        }
    }, [isStripeProvider]);

    // Watch card number for BIN detection
    useEffect(() => {
        const cleanNumber = paymentData.cardNumber.replace(/\s/g, '');
        const bin = cleanNumber.slice(0, 6);
        
        // Local Brand Detection (Fallback if API fails)
        const localBrand = getBrandFromCardNumber(cleanNumber);
        if (localBrand) {
            setPaymentMethodId(localBrand);
        }

        if (bin.length === 6 && plan) {
            updateInstallments(bin);
        }
    }, [paymentData.cardNumber, plan]);

    const getBrandFromCardNumber = (number: string): string | null => {
        if (!number) return null;
        if (/^4/.test(number)) return 'visa';
        if (/^5[1-5]|^2[2-7]/.test(number)) return 'master';
        if (/^3[47]/.test(number)) return 'amex';
        if (/^6062|^3841|^6370|^6375|^6376|^6372|^6371|^6040/.test(number)) return 'hipercard';
        if (/^4011|^5067|^4576|^4389|^5041|^6363|^6362|^5066|^5090|^6504|^6505|^6506|^6507|^6509|^6516|^6550|^6552/.test(number)) return 'elo';
        if (/^6011|^622|^64|^65/.test(number)) return 'discover';
        return null;
    };

    const updateInstallments = async (bin?: string, paymentMethodId?: string) => {
        const normalizedPaymentMethodId = normalizePaymentMethodId(paymentMethodId);

        try {
            const data = await paymentsService.getInstallments({
                amount: plan?.price,
                bin,
                paymentMethodId: normalizedPaymentMethodId || undefined,
            });

            if (data && data[0]) {
                setInstallmentOptions(data[0].payer_costs || []);
                // Only override if the API actually gave us a brand
                if (data[0].payment_method_id) {
                    setPaymentMethodId(normalizePaymentMethodId(data[0].payment_method_id));
                } else if (normalizedPaymentMethodId) {
                    setPaymentMethodId(normalizedPaymentMethodId);
                }
                // Capture issuer ID (Crucial for Elo/Hipercard to avoid 2131 error)
                if (data[0].issuer?.id) {
                    setIssuerId(data[0].issuer.id.toString());
                } else {
                    setIssuerId(null);
                }
            }
        } catch (err) {
            console.error('Failed to fetch installments:', err);
            if (normalizedPaymentMethodId) {
                setPaymentMethodId(normalizedPaymentMethodId);
            }
        }
    };

    const resolvePaymentMetadata = async ({
        bin,
        fallbackPaymentMethodId,
        fallbackIssuerId,
    }: {
        bin?: string;
        fallbackPaymentMethodId?: string | null;
        fallbackIssuerId?: string | number | null;
    }) => {
        const cleanBin = (bin || '').replace(/\D/g, '').slice(0, 8);
        let resolvedPaymentMethodId = normalizePaymentMethodId(fallbackPaymentMethodId);
        let resolvedIssuerId = fallbackIssuerId ? String(fallbackIssuerId) : null;

        if (cleanBin.length >= 6) {
            try {
                const paymentMethodsResponse = await getPaymentMethods({ bin: cleanBin });
                const matchedMethod = paymentMethodsResponse?.results?.find((method: any) => {
                    return normalizePaymentMethodId(method.id) === resolvedPaymentMethodId;
                }) || paymentMethodsResponse?.results?.[0];

                if (matchedMethod?.id) {
                    resolvedPaymentMethodId = normalizePaymentMethodId(matchedMethod.id);
                }

                if (resolvedPaymentMethodId) {
                    const issuersResponse = await getIssuers({
                        paymentMethodId: resolvedPaymentMethodId,
                        bin: cleanBin,
                    });

                    if (issuersResponse?.[0]?.id) {
                        resolvedIssuerId = String(issuersResponse[0].id);
                    }

                    const installmentsResponse = await getInstallments({
                        amount: String(Number(plan?.price || 0)),
                        bin: cleanBin,
                        paymentMethodId: resolvedPaymentMethodId,
                        paymentTypeId: 'credit_card',
                        locale: 'pt-BR',
                    });

                    if (installmentsResponse?.[0]?.payment_method_id) {
                        resolvedPaymentMethodId = normalizePaymentMethodId(installmentsResponse[0].payment_method_id);
                    }

                    if (installmentsResponse?.[0]?.issuer?.id) {
                        resolvedIssuerId = String(installmentsResponse[0].issuer.id);
                    }

                    if (installmentsResponse?.[0]?.payer_costs?.length) {
                        setInstallmentOptions(installmentsResponse[0].payer_costs);
                    }
                }
            } catch (sdkError) {
                console.warn('Mercado Pago SDK metadata resolution failed, falling back to current state.', sdkError);
            }
        }

        if (resolvedPaymentMethodId) {
            setPaymentMethodId(resolvedPaymentMethodId);
        }
        setIssuerId(resolvedIssuerId);

        return {
            paymentMethodId: resolvedPaymentMethodId,
            issuerId: resolvedIssuerId,
            bin: cleanBin,
        };
    };

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
                        if (targetPlanTier <= currentPlanTier && targetPlanTimeScore <= currentTimeScore) {
                            addToast(`VocÃª jÃ¡ possui o plano ${currentUser.subscription.plan?.name || 'Premium'}. NÃ£o Ã© possÃ­vel assinar um plano inferior ou igual enquanto o atual estiver ativo.`, 'warning');
                            navigate('/profile');
                            return;
                        }

                        if (targetPlanTier < currentPlanTier) {
                            setShowDowngradeModal(true);
                        }

                        const currentPlan = plans.find(p => p.id === currentUser.subscription?.plan_id);
                        if (currentPlan && currentPlan.price > 0 && currentUser.subscription.current_period_start && currentUser.subscription.current_period_end) {
                            const start = new Date(currentUser.subscription.current_period_start).getTime();
                            const end = new Date(currentUser.subscription.current_period_end).getTime();
                            const now = Date.now();
                            if (end > now && end > start) {
                                const totalDuration = end - start;
                                const remaining = end - now;
                                const credit = (currentPlan.price * remaining) / totalDuration;
                                setProRatedCredit(Math.round(credit * 100) / 100);
                            }
                        }
                    }
                }
            } else {
                addToast('Plano nÃ£o encontrado', 'error');
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
                const res = await cardsService.listSavedCards(currentUser?.id);
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
            const res = await cardsService.listSavedCards(currentUser.id);
            
            if (import.meta.env.DEV) console.log('ðŸ’³ Cards API Response:', res);

            if (res.removed_stale_cards > 0) {
                addToast('Removemos cartÃ£o(Ãµes) salvos vinculados a um ambiente antigo do Mercado Pago. Salve novamente o cartÃ£o para reutilizÃ¡-lo.', 'warning');
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
        }
    }, [currentUser, isStripeProvider, cardVaultProvider]);

    useEffect(() => {
        if (step === 'success') {
            const timer = setTimeout(() => {
                navigate('/profile?tab=billing');
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
            setStep('payment');
            setPaymentData(prev => ({ ...prev, payerName: currentUser.name, cpf: currentUser.cpf || '' }));
        } else {
            setStep('identification');
        }
    }, [currentUser]);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setAuthLoading(true);

        try {
            if (authMode === 'register') {
                if (formData.password !== formData.confirmPassword) {
                    addToast('As senhas nÃ£o coincidem.', 'error');
                    setAuthLoading(false);
                    return;
                }

                if (recaptchaEnabled && !captchaToken) {
                    addToast('Por favor, complete o desafio de seguranÃ§a.', 'error');
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
                } else {
                    addToast('Erro ao criar conta.', 'error');
                    if (recaptchaRef.current) recaptchaRef.current.reset();
                    setCaptchaToken(null);
                }

            } else {
                if (recaptchaEnabled && !captchaToken) {
                    addToast('Por favor, complete o desafio de seguranÃ§a.', 'error');
                    setAuthLoading(false);
                    return;
                }

                const result = await authFlowService.login({
                    email: formData.email,
                    password: formData.password,
                    captchaToken
                });

                if (result.require2FA) {
                    addToast('Esta conta exige 2FA. Entre pela tela de autenticacao para concluir o login.', 'warning');
                    navigate('/auth?mode=login');
                } else if (result.user) {
                    const { user, token } = result;
                    await login(user, token);
                    addToast('Login realizado com sucesso!', 'success');
                } else {
                    addToast('Credenciais invÃ¡lidas.', 'error');
                    if (recaptchaRef.current) recaptchaRef.current.reset();
                    setCaptchaToken(null);
                }
            }
        } catch (error) {
            console.error(error);
            addToast('Erro ao realizar autenticaÃ§Ã£o.', 'error');
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
            const response = await planService.validateCoupon(
                couponCode,
                Number(plan?.price || 0),
                plan?.id,
            );

            if (response.success && response.coupon) {
                setAppliedCoupon(response.coupon);
                setDiscountAmount(Number(response.coupon.discount_amount || 0));
                addToast('Cupom aplicado com sucesso!', 'success');
            } else {
                addToast(response.message || 'Cupom invÃ¡lido ou expirado.', 'error');
                setAppliedCoupon(null);
                setDiscountAmount(0);
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
            addToast('Perfil atualizado. Agora voce ja pode concluir a compra.', 'success');
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
            addToast(message || 'E-mail de confirmacao reenviado com sucesso.', 'success');
        } catch (error: any) {
            addToast(error.message || 'Erro ao reenviar o e-mail de confirmacao.', 'error');
        } finally {
            setIsResendingConfirmation(false);
        }
    };

    const handlePayment = async () => {
        if (!plan || !currentUser) return;

        if (!ensureCheckoutRequirements()) {
            return;
        }

        if (isStripeProvider) {
            if (selectedMethod !== 'credit_card') {
                addToast('O checkout Stripe desta plataforma aceita assinaturas apenas por cartao.', 'warning');
                return;
            }

            if (isStripeInternalCheckout) {
                addToast('Use o formulario de cartao abaixo para concluir a assinatura sem sair da plataforma.', 'info');
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
                    throw new Error(response?.message || 'Nao foi possivel iniciar o checkout Stripe.');
                }

                window.location.href = redirectUrl;
                return;
            } catch (error: any) {
                console.error('Stripe checkout error:', error);
                const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message || 'Erro ao iniciar o checkout Stripe.';
                addToast(errorMsg, 'error');
                setProcessing(false);
                return;
            }
        }

        if (selectedMethod === 'credit_card') {
            if (isUsingSavedCard) {
                if (!savedCardCheckoutSupported) {
                    addToast(savedCardCheckoutBlockedMessage, 'warning');
                    return;
                }
                if (!selectedCard) {
                    addToast('Selecione um cartÃ£o para continuar.', 'warning');
                    return;
                }
                if (!savedCardSecurityReady) {
                    addToast(savedCardSecurityError || 'Preencha o cÃ³digo de seguranÃ§a do cartÃ£o salvo.', 'warning');
                    return;
                }
            } else if (!paymentData.cardNumber || !paymentData.cardHolder || !paymentData.cardExpiry || !paymentData.cardCvv || !paymentData.cpf) {
                addToast('Preencha todos os dados do cartÃ£o.', 'error');
                return;
            }
        } else {
            if (!paymentData.payerName || !paymentData.cpf) {
                addToast('Preencha os dados do pagador.', 'error');
                return;
            }
        }

        if (selectedMethod === 'credit_card' && isUsingSavedCard && savedCardSecurityReady && !savedCardSecurityComplete) {
            addToast(savedCardSecurityError || 'Digite o codigo de seguranca do cartao salvo para continuar.', 'warning');
            return;
        }

        setProcessing(true);
        try {
            if (selectedMethod === 'credit_card') {
                let cardToken: string = '';
                let cardLastFour: string = '';
                let cardBin: string = '';

                try {
                    const mp = new window.MercadoPago(MP_PUBLIC_KEY);
                    
                    if (isUsingSavedCard && selectedCard) {
                        const savedCardMp = savedCardMpRef.current || mp;
                        const cardTokenRes = await savedCardMp.fields.createCardToken({
                            cardId: selectedCard.mp_card_id,
                        });
                        
                        if (!cardTokenRes || !cardTokenRes.id) {
                            throw new Error('Erro ao validar o cartÃ£o salvo com o Mercado Pago. Verifique o cÃ³digo de seguranÃ§a.');
                        }
                        
                        cardToken = cardTokenRes.id;
                        cardLastFour = selectedCard.last_four_digits;
                        cardBin = (cardTokenRes.first_six_digits || selectedCard.first_six_digits || selectedCard.bin || '').toString();
                    } else {
                        const [expiryMonth, expiryYear] = paymentData.cardExpiry.split('/');
                        const fullYear = expiryYear?.trim().length === 2 ? '20' + expiryYear.trim() : expiryYear?.trim() || '';

                        const cardTokenRes = await mp.createCardToken({
                            cardNumber:           paymentData.cardNumber.replace(/\s/g, ''),
                            cardholderName:       paymentData.cardHolder,
                            cardExpirationMonth:  expiryMonth.trim(),
                            cardExpirationYear:   fullYear,
                            securityCode:         paymentData.cardCvv,
                            identificationType:   'CPF',
                            identificationNumber: paymentData.cpf.replace(/\D/g, ''),
                            cardholderEmail:      currentUser?.email || '',
                        });

                        if (!cardTokenRes || !cardTokenRes.id) {
                            throw new Error('Erro ao gerar token de seguranÃ§a do cartÃ£o. Verifique os dados.');
                        }

                        cardToken    = cardTokenRes.id;
                        cardLastFour = paymentData.cardNumber.replace(/\s/g, '').slice(-4);
                        cardBin = (cardTokenRes.first_six_digits || paymentData.cardNumber.replace(/\D/g, '').slice(0, 8)).toString();
                    }
                } catch (tkErr: any) {
                    console.error('Tokenization error:', tkErr);
                    throw new Error(tkErr.message || 'Falha na comunicaÃ§Ã£o segura com o Mercado Pago.');
                }

                const installments = isRecurring ? 1 : parseInt(paymentData.installments, 10);
                const resolvedPayment = await resolvePaymentMetadata({
                    bin: cardBin,
                    fallbackPaymentMethodId: isUsingSavedCard ? (selectedCard?.payment_method_id || selectedCard?.brand) : paymentMethodId,
                    fallbackIssuerId: isUsingSavedCard ? selectedCard?.issuer_id : issuerId,
                });

                if (!cardToken) {
                    throw new Error('Token do cartÃƒÂ£o ausente. A tokenizaÃƒÂ§ÃƒÂ£o nÃƒÂ£o foi concluÃƒÂ­da.');
                }

                if (!resolvedPayment.paymentMethodId) {
                    throw new Error('NÃƒÂ£o foi possÃƒÂ­vel identificar o payment_method_id do cartÃƒÂ£o.');
                }

                if (!Number.isFinite(installments) || installments < 1) {
                    throw new Error('NÃƒÂºmero de parcelas invÃƒÂ¡lido para o pagamento.');
                }

                const paymentPayload = {
                    token: cardToken,
                    card_bin: resolvedPayment.bin || cardBin || undefined,
                    plan_id: plan.id,
                    amount: monetaryTotals.totalDue,
                    transaction_amount: monetaryTotals.totalDue,
                    user_id: currentUser.id,
                    payment_method_id: resolvedPayment.paymentMethodId,
                    issuer_id: resolvedPayment.issuerId || undefined,
                    local_card_id: isUsingSavedCard ? selectedCard?.id : undefined,
                    installments,
                    recurring_mode: isRecurring,
                    is_recurring: isRecurring,
                    auto_renew: autoRenew,
                    save_card: saveCard || autoRenew || isRecurring,
                    pro_rated_credit: proRatedCredit,
                    coupon_code: appliedCoupon?.code,
                    discount_amount: discountAmount,
                    cardLastFour,
                    payer: {
                        email: currentUser.email,
                    } as Record<string, any>
                };

                if (!isUsingSavedCard) {
                    paymentPayload.payer.identification = {
                        type: 'CPF',
                        number: paymentData.cpf.replace(/\D/g, '')
                    };
                }

                logMercadoPagoDebug('payload', {
                    token: maskToken(paymentPayload.token),
                    payment_method_id: paymentPayload.payment_method_id,
                    issuer_id: paymentPayload.issuer_id || null,
                    installments: paymentPayload.installments,
                    transaction_amount: paymentPayload.transaction_amount,
                    local_card_id: paymentPayload.local_card_id || null,
                    recurring_mode: paymentPayload.recurring_mode,
                    is_saved_card: isUsingSavedCard,
                    card_bin: resolvedPayment.bin || cardBin || null,
                });

                const response = await planService.processPayment(paymentPayload);

                logMercadoPagoDebug('response', {
                    success: response?.success,
                    status: response?.status,
                    error: response?.error || null,
                });

                if (response.success && response.status === 'approved') {
                    setStep('success');
                    setProcessing(false);
                    await refreshUser();
                    await loadSavedCards();

                    if (response.card_save_warning) {
                        addToast(response.card_save_warning, 'warning');
                    } else if (response.card_saved && !isUsingSavedCard) {
                        addToast('CartÃ£o salvo com sucesso para compras futuras.', 'success');
                    }
                } else {
                    addToast(response.error || 'Pagamento recusado ou erro no processamento.', 'error');
                    setProcessing(false);
                }
            } else {
                addToast('Processamento via PIX/Boleto em breve. Use cartÃ£o de crÃ©dito.', 'info');
                setProcessing(false);
            }
        } catch (error: any) {
            console.error(error);
            if (error.response?.data?.error_code === 2010) {
                await loadSavedCards();
                setIsUsingSavedCard(false);
                setSelectedCard(null);
            }
            const errorMsg = error.response?.data?.error || error.message || 'Erro ao processar pagamento.';
            addToast(errorMsg, 'error');
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
                throw new Error(response?.message || 'Nao foi possivel iniciar a assinatura Stripe.');
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
            throw new Error('A assinatura Stripe nao retornou um identificador para a confirmacao final.');
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
            throw new Error(response?.message || 'Nao foi possivel finalizar a assinatura Stripe.');
        }

        const payload = response?.data || response;
        await refreshUser();
        await loadSavedCards();

        setPendingStripeSubscriptionId(null);
        setPendingStripePaymentMethodId(null);

        if (payload?.card_saved && !options?.savedCardId) {
            addToast('Cartao salvo com sucesso para compras futuras.', 'success');
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
            throw new Error('Selecione um cartao salvo para continuar.');
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
                throw new Error(response?.message || 'Nao foi possivel iniciar a cobranca com o cartao salvo.');
            }

            const payload = response?.data || response;
            const savedPaymentMethodId = selectedStripeCard.stripe_payment_method_id || null;

            if (payload?.client_secret) {
                if (!savedPaymentMethodId) {
                    throw new Error('O cartao salvo selecionado nao possui um metodo de pagamento Stripe valido.');
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
                    throw new Error(confirmation.error.message || 'Nao foi possivel confirmar o codigo de seguranca do cartao salvo.');
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
            const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message || 'Erro ao processar o cartao salvo.';
            addToast(errorMsg, 'error');
            throw error;
        } finally {
            setProcessing(false);
        }
    };

    const displayName = useMemo(() => {
        if (!plan) return '';
        return plan.name
            .replace(' - Mensal', '')
            .replace(' - Trimestral', '')
            .replace(' - Anual', '')
            .toUpperCase();
    }, [plan]);

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

    const selectedInstallment = useMemo(() => {
        if (!plan) return { installments: 1, installment_amount: 0, total_amount: 0 };
        if (isStripeProvider) {
            if (supportsStripeBillingChoices && selectedStripeInstallmentCount > 1) {
                const amount = Number((Number(plan.price) / selectedStripeInstallmentCount).toFixed(2));
                return {
                    installments: selectedStripeInstallmentCount,
                    installment_amount: amount,
                    total_amount: Number(plan.price),
                };
            }

            return { installments: 1, installment_amount: Number(plan.price), total_amount: Number(plan.price) };
        }
        const installmentsNumber = Number(paymentData.installments) || 1;

        if (isRecurring) {
            const amount = plan.price / maxInstallments;
            return { installments: 1, installment_amount: amount, total_amount: amount };
        }

        const marketplaceOpt = installmentOptions.find(
            (opt: any) => Number(opt.installments) === installmentsNumber
        );

        if (marketplaceOpt) {
            return {
                installments: marketplaceOpt.installments,
                installment_amount: marketplaceOpt.installment_amount,
                total_amount: marketplaceOpt.total_amount ?? (marketplaceOpt.installment_amount * marketplaceOpt.installments),
            };
        }

        const rate = 0.0299; 
        const amount = installmentsNumber === 1
            ? Number(plan.price)
            : (Number(plan.price) * rate) / (1 - Math.pow(1 + rate, -installmentsNumber));

        return {
            installments: installmentsNumber,
            installment_amount: amount,
            total_amount: amount * installmentsNumber,
        };
    }, [plan, installmentOptions, paymentData.installments, isRecurring, isStripeProvider, maxInstallments, supportsStripeBillingChoices, selectedStripeInstallmentCount]);

    const monetaryTotals = useMemo(() => {
        if (!plan) return { firstCharge: 0, totalDue: 0 };
        const discount = appliedCoupon ? discountAmount : 0;
        
        // Se for recorrente, baseamos no valor da parcela
        // Caso contrÃ¡rio, usamos o total_amount do parcelamento selecionado (que jÃ¡ inclui juros se houver)
        const baseAmount = isStripeProvider
            ? (supportsStripeBillingChoices && selectedStripeInstallmentCount > 1
                ? selectedInstallment.installment_amount
                : Number(plan.price))
            : isRecurring 
            ? (plan.price / maxInstallments) 
            : selectedInstallment.total_amount;

        const totalDue = Math.max(0, baseAmount - proRatedCredit - discount);
        return { firstCharge: baseAmount, totalDue };
    }, [plan, isRecurring, isStripeProvider, maxInstallments, proRatedCredit, appliedCoupon, discountAmount, selectedInstallment.installment_amount, selectedInstallment.total_amount, supportsStripeBillingChoices, selectedStripeInstallmentCount]);

    const paymentProviderLabel = isStripeProvider ? 'Stripe' : 'Mercado Pago';
    const selectedMethodLabel = selectedMethod === 'credit_card' ? 'Cartao' : selectedMethod === 'pix' ? 'Pix' : 'Boleto';
    const renewalLabel = autoRenew ? 'Automatica' : 'Manual';
    const paymentActionLabel = isStripeProvider
        ? (isStripeInternalCheckout ? 'Finalize no formulario Stripe abaixo' : 'Continuar para pagamento')
        : isRecurring
            ? 'Ativar assinatura'
            : 'Pagar agora';
    const processingLabel = isStripeProvider
        ? (isStripeInternalCheckout ? 'Processando assinatura Stripe...' : 'Abrindo checkout Stripe...')
        : 'Processando SeguranÃ§a...';

    const checkoutBillingLabel = isStripeProvider
        ? (supportsStripeBillingChoices && selectedStripeInstallmentCount > 1
            ? `${selectedStripeInstallmentCount}x de R$ ${selectedInstallment.installment_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
            : `1x de R$ ${Number(plan?.price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`)
        : (!isRecurring && selectedInstallment.installments > 1
            ? `${selectedInstallment.installments}x de R$ ${selectedInstallment.installment_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
            : `1x de R$ ${Number(monetaryTotals.firstCharge || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);

    const renderSuccessStep = () => (
        <div className="overflow-hidden rounded-[2.25rem] border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-[#1a1c2e]">
            <div className="px-8 pb-6 pt-10 text-center md:px-12">
                <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500 text-white shadow-2xl shadow-emerald-500/30">
                    <CheckCircle2 size={46} />
                </div>
                <div className="mt-6 space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-600 dark:text-emerald-400">Pagamento aprovado</p>
                    <h2 className="text-3xl font-black leading-none text-slate-900 dark:text-white">Pagamento aprovado!</h2>
                    <p className="mx-auto max-w-xl text-base font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                        Sua assinatura do plano <span className="font-black text-slate-900 dark:text-white">{displayName}</span> foi confirmada com sucesso e o acesso ja esta pronto para uso.
                    </p>
                </div>
            </div>

            <div className="grid gap-4 border-y border-slate-100 bg-slate-50 px-8 py-6 dark:border-slate-800 dark:bg-[#121528] md:grid-cols-3 md:px-12">
                <div className="rounded-[1.5rem] border border-slate-200 bg-white px-5 py-5 dark:border-slate-800 dark:bg-[#1a1c2e]">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Plano</p>
                    <p className="mt-3 text-lg font-black leading-none text-slate-900 dark:text-white">{displayName}</p>
                    <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">{billingCycle}</p>
                </div>
                <div className="rounded-[1.5rem] border border-slate-200 bg-white px-5 py-5 dark:border-slate-800 dark:bg-[#1a1c2e]">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Cobranca confirmada</p>
                    <p className="mt-3 text-lg font-black leading-none text-slate-900 dark:text-white">R$ {monetaryTotals.totalDue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">{checkoutBillingLabel}</p>
                </div>
                <div className="rounded-[1.5rem] border border-slate-200 bg-white px-5 py-5 dark:border-slate-800 dark:bg-[#1a1c2e]">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Proximo passo</p>
                    <p className="mt-3 text-lg font-black leading-none text-slate-900 dark:text-white">Ir para a assinatura</p>
                    <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">Veja o status do plano, transacoes e renovacao automatica.</p>
                </div>
            </div>

            <div className="px-8 py-8 text-center md:px-12">
                <button
                    onClick={() => navigate('/profile?tab=billing')}
                    className="inline-flex h-14 items-center justify-center gap-3 rounded-2xl bg-indigo-600 px-8 text-[10px] font-black uppercase tracking-[0.2em] text-white transition-all hover:bg-indigo-700"
                >
                    Ir para minha assinatura
                    <ArrowRight size={16} />
                </button>
                <p className="mt-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                    Redirecionamento automatico em {countdown} segundos
                </p>
            </div>
        </div>
    );

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
            navigate('/profile?tab=billing');
        } else {
            navigate(-1);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-[#0f1020] py-12 px-4 relative overflow-hidden transition-colors duration-500">
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
            <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-indigo-50 to-transparent dark:from-indigo-900/10 dark:to-transparent pointer-events-none"></div>
            
            <div className="container mx-auto max-w-5xl relative z-10">
                <button onClick={handleBack} className="flex items-center gap-2 text-slate-400 dark:text-slate-500 hover:text-slate-800 dark:hover:text-white transition-all mb-8 group font-black text-[10px] uppercase tracking-[0.2em]">
                    <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
                    Voltar
                </button>

                {/* Progress Indicator */}
                <div className="flex items-center justify-center mb-12 gap-3 max-w-2xl mx-auto">
                    {[
                        { id: 'identification' as CheckoutStep, label: 'IdentificaÃ§Ã£o' },
                        { id: 'payment' as CheckoutStep, label: 'Pagamento' },
                        { id: 'success' as CheckoutStep, label: 'ConfirmaÃ§Ã£o' }
                    ].map((s, idx, arr) => {
                        const stepsOrder: CheckoutStep[] = ['identification', 'payment', 'success'];
                        const currentIdx = stepsOrder.indexOf(step);
                        const isPast = idx < currentIdx;
                        const isCurrent = idx === currentIdx;
                        
                        return (
                            <React.Fragment key={s.id}>
                                <div className="flex flex-col items-center gap-2 flex-1 group">
                                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-xs transition-all duration-500 ${isCurrent ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-500/20 scale-110' : isPast ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'}`}>
                                        {isPast ? <CheckCircle2 size={18} /> : idx + 1}
                                    </div>
                                    <span className={`font-black text-[9px] uppercase tracking-widest hidden md:block ${isCurrent ? 'text-indigo-600 dark:text-indigo-400' : isPast ? 'text-emerald-500' : 'text-slate-400'}`}>{s.label}</span>
                                </div>
                                {idx < arr.length - 1 && <div className={`w-full h-[2px] mt-5 transition-colors duration-700 ${isPast ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-800'}`}></div>}
                            </React.Fragment>
                        );
                    })}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                    <div className={`${step === 'success' ? 'lg:col-span-3 max-w-2xl mx-auto' : 'lg:col-span-2'} space-y-6 transition-all duration-700`}>
                        {step === 'identification' && (
                            <div className="bg-white dark:bg-[#1a1c2e] border border-slate-200 dark:border-slate-800 rounded-[2rem] p-8 md:p-10 shadow-2xl animate-in zoom-in-95 duration-500">
                                <div className="max-w-md mx-auto space-y-8">
                                    <div className="text-center space-y-2">
                                        <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl flex items-center justify-center mx-auto text-indigo-600 dark:text-indigo-400 mb-4"><User size={32} /></div>
                                        <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">IdentificaÃ§Ã£o</h2>
                                        <p className="text-sm text-slate-500">Acesse sua conta ou crie uma nova para continuar.</p>
                                    </div>

                                    <div className="flex bg-slate-100 dark:bg-[#0f1020] p-1.5 rounded-2xl">
                                        <button onClick={() => setAuthMode('register')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${authMode === 'register' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Criar Conta</button>
                                        <button onClick={() => setAuthMode('login')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${authMode === 'login' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>JÃ¡ tenho conta</button>
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
                                                <input type="password" required value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} className="w-full h-14 pl-12 pr-4 bg-slate-50 dark:bg-[#0f1020] border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-white font-bold outline-none focus:border-indigo-500 transition-all placeholder:text-slate-400" placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢" />
                                            </div>
                                        </div>
                                        {recaptchaEnabled && <div className="flex justify-center py-2"><ReCAPTCHA ref={recaptchaRef} sitekey={systemSettings?.recaptchaSiteKey || ''} onChange={setCaptchaToken} theme={document.documentElement.classList.contains('dark') ? 'dark' : 'light'} /></div>}
                                        <button type="submit" disabled={authLoading} className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] rounded-2xl text-white font-black uppercase tracking-widest shadow-xl shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-70">
                                            {authLoading ? <span className="animate-pulse">Aguarde...</span> : <>{authMode === 'register' ? 'Criar Minha Conta' : 'Acessar Minha Conta'} <ArrowRight size={18} /></>}
                                        </button>
                                    </form>
                                </div>
                            </div>
                        )}

                        {step === 'payment' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                                <div className="bg-white dark:bg-[#1a1c2e] border border-slate-200 dark:border-slate-800 rounded-[2rem] p-8 md:p-10 shadow-2xl">
                                    <div className="space-y-8">
                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                            <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-3 uppercase tracking-tight">
                                                <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400"><CreditCard size={20} /></div>
                                                Finalizar compra
                                            </h2>
                                            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 rounded-full">
                                                <ShieldCheck size={14} className="text-emerald-500" />
                                                <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Checkout seguro</span>
                                            </div>
                                        </div>

                                        {!isStripeProvider && (
                                            <div className="space-y-2">
                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Forma de pagamento</p>
                                            </div>
                                        )}

                                        {isStripeProvider ? (
                                            <div className="grid grid-cols-1 gap-4">
                                                <button className="p-5 rounded-2xl border-2 bg-indigo-50 dark:bg-indigo-600/10 border-indigo-600 dark:border-indigo-500 text-indigo-700 dark:text-indigo-400 shadow-lg flex items-center justify-between">
                                                    <div className="flex items-center gap-4">
                                                        <CreditCard size={24} />
                                                        <div className="text-left">
                                                            <p className="text-[10px] font-black uppercase tracking-[0.2em]">Cartao</p>
                                                            <p className="text-[11px] font-medium mt-1">
                                                                {isStripeInternalCheckout ? 'Pagamento direto nesta pÃ¡gina' : 'Pagamento seguro com redirecionamento'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <ShieldCheck size={16} />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <button onClick={() => setSelectedMethod('credit_card')} className={`p-5 rounded-2xl border-2 flex flex-col items-center gap-4 transition-all duration-300 ${selectedMethod === 'credit_card' ? 'bg-indigo-50 dark:bg-indigo-600/10 border-indigo-600 dark:border-indigo-500 text-indigo-700 dark:text-indigo-400 shadow-lg' : 'bg-slate-50 dark:bg-[#0f1020] border-slate-200 dark:border-slate-800 text-slate-400'}`}>
                                                    <CreditCard size={28} />
                                                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">CartÃ£o</span>
                                                </button>
                                                <button disabled={isRecurring || isStripeProvider} onClick={() => setSelectedMethod('pix')} className={`p-5 rounded-2xl border-2 flex flex-col items-center gap-4 transition-all duration-300 ${selectedMethod === 'pix' ? 'bg-indigo-50 dark:bg-indigo-600/10 border-indigo-600 dark:border-indigo-500 text-indigo-700 dark:text-indigo-400 shadow-lg' : 'bg-slate-50 dark:bg-[#0f1020] border-slate-200 dark:border-slate-800 text-slate-400'} ${(isRecurring || isStripeProvider) ? 'opacity-40 cursor-not-allowed' : ''}`}>
                                                    <QrCode size={28} />
                                                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">PIX</span>
                                                </button>
                                                <button disabled={isRecurring || isStripeProvider} onClick={() => setSelectedMethod('boleto')} className={`p-5 rounded-2xl border-2 flex flex-col items-center gap-4 transition-all duration-300 ${selectedMethod === 'boleto' ? 'bg-indigo-50 dark:bg-indigo-600/10 border-indigo-600 dark:border-indigo-500 text-indigo-700 dark:text-indigo-400 shadow-lg' : 'bg-slate-50 dark:bg-[#0f1020] border-slate-200 dark:border-slate-800 text-slate-400'} ${(isRecurring || isStripeProvider) ? 'opacity-40 cursor-not-allowed' : ''}`}>
                                                    <FileText size={28} />
                                                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Boleto</span>
                                                </button>
                                            </div>
                                        )}

                                        <div className="space-y-2">
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Dados do pagamento</p>
                                        </div>
                                        <div className="bg-slate-100 dark:bg-[#0f1020] p-6 md:p-8 rounded-[2rem] border border-slate-200 dark:border-slate-800">
                                            {isStripeProvider ? (
                                                <div className="space-y-5">
                                                    {isLoadingStripeCards ? (
                                                        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121528] p-4 text-sm font-semibold text-slate-500 dark:text-slate-400">
                                                            Carregando cartÃµes salvos...
                                                        </div>
                                                    ) : stripeCards.length > 0 ? (
                                                        <div className="space-y-3">
                                                            <div className="flex items-center justify-between">
                                                                <div>
                                                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">CartÃµes salvos</p>
                                                                    <p className="mt-1 text-sm font-semibold text-slate-600 dark:text-slate-300">
                                                                        Escolha um cartÃ£o salvo ou use um cartÃ£o novo nesta compra.
                                                                    </p>
                                                                </div>
                                                                <span className="px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                                                                    {stripeCards.length} salvo(s)
                                                                </span>
                                                            </div>

                                                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                                                {stripeCards.map((card: any) => {
                                                                    const isSelected = selectedStripeCardId === card.id;
                                                                    return (
                                                                        <button
                                                                            key={card.id}
                                                                            type="button"
                                                                            onClick={() => {
                                                                                setSelectedStripeCardId(card.id);
                                                                                setSaveCard(false);
                                                                            }}
                                                                            className={`rounded-2xl border p-4 text-left transition-all ${
                                                                                isSelected
                                                                                    ? 'border-indigo-500 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-500/10'
                                                                                    : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-[#121528]'
                                                                            }`}
                                                                        >
                                                                            <div className="flex items-center justify-between gap-3">
                                                                                <div>
                                                                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">{String(card.brand || 'card').toUpperCase()}</p>
                                                                                    <p className="mt-1 text-sm font-black text-slate-900 dark:text-white">â€¢â€¢â€¢â€¢ {card.last_four_digits}</p>
                                                                                    <p className="mt-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">Expira em {String(card.exp_month).padStart(2, '0')}/{String(card.exp_year).slice(-2)}</p>
                                                                                </div>
                                                                                <div className="flex flex-col items-end gap-2">
                                                                                    {Number(card.is_default) === 1 && (
                                                                                        <span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                                                                                            PadrÃ£o
                                                                                        </span>
                                                                                    )}
                                                                                    {isSelected && <CheckCircle2 size={18} className="text-indigo-600 dark:text-indigo-400" />}
                                                                                </div>
                                                                            </div>
                                                                        </button>
                                                                    );
                                                                })}

                                                                <button
                                                                    type="button"
                                                                    onClick={() => setSelectedStripeCardId(null)}
                                                                    className={`rounded-2xl border border-dashed p-4 text-left transition-all ${
                                                                        !isUsingStripeSavedCard
                                                                            ? 'border-indigo-500 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-500/10'
                                                                            : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-[#121528]'
                                                                    }`}
                                                                >
                                                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Novo cartÃ£o</p>
                                                                    <p className="mt-1 text-sm font-black text-slate-900 dark:text-white">Informar novos dados</p>
                                                                    <p className="mt-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">Use outro cartÃ£o e escolha se quer salvÃ¡-lo no seu perfil.</p>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : null}

                                                    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-[#121528]">
                                                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                                                                Parcelamento:
                                                            </label>
                                                            <select
                                                                value={String(selectedStripeInstallmentCount)}
                                                                onChange={(event) => setPaymentData(prev => ({ ...prev, installments: event.target.value }))}
                                                                className="h-11 min-w-[220px] rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-900 outline-none transition-all focus:border-indigo-500 dark:border-slate-700 dark:bg-[#0f1020] dark:text-white"
                                                            >
                                                                <option value="1">
                                                                    1x de R$ {Number(plan.price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                                </option>
                                                                {supportsStripeBillingChoices && Array.from({ length: maxInstallments - 1 }, (_, index) => {
                                                                    const installments = index + 2;
                                                                    const installmentAmount = Number((Number(plan.price || 0) / installments).toFixed(2));
                                                                    return (
                                                                        <option key={installments} value={String(installments)}>
                                                                            {installments}x de R$ {installmentAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                                        </option>
                                                                    );
                                                                })}
                                                            </select>
                                                        </div>
                                                    </div>

                                                    {isStripeInternalCheckout ? (
                                                        isUsingStripeSavedCard ? (
                                                            <div className="rounded-[2rem] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121528] p-6 space-y-5">
                                                                <div className="space-y-2">
                                                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">CartÃ£o selecionado</p>
                                                                    <p className="text-base font-black text-slate-900 dark:text-white">
                                                                        {String(selectedStripeCard?.brand || 'card').toUpperCase()} â€¢â€¢â€¢â€¢ {selectedStripeCard?.last_four_digits}
                                                                    </p>
                                                                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                                                                        O pagamento serÃ¡ confirmado com este cartÃ£o salvo. Se a Stripe solicitar autenticaÃ§Ã£o adicional, vocÃª verÃ¡ a confirmaÃ§Ã£o segura logo em seguida.
                                                                    </p>
                                                                </div>

                                                                <StripeSavedCardCvcForm
                                                                    publishableKey={STRIPE_PUBLISHABLE_KEY}
                                                                    cardBrand={selectedStripeCard?.brand}
                                                                    last4={selectedStripeCard?.last_four_digits}
                                                                    submitLabel={processing ? 'Confirmando cartao salvo...' : 'Pagar com cartao salvo'}
                                                                    onConfirm={handleStripeSavedCardPayment}
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => undefined}
                                                                    disabled
                                                                    className="hidden"
                                                                >
                                                                    {processing ? 'Processando pagamento...' : 'Pagar com cartÃ£o salvo'}
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div className="rounded-[2rem] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121528] p-6 space-y-5">
                                                                <StripeCardElementForm
                                                                    publishableKey={STRIPE_PUBLISHABLE_KEY}
                                                                    billingName={currentUser.name}
                                                                    billingEmail={currentUser.email}
                                                                    billingAddress={currentUser.address}
                                                                    submitLabel={processing ? 'Processando pagamento...' : 'Pagar com cartÃ£o'}
                                                                    onPaymentMethodCreated={handleStripeInternalPayment}
                                                                onPaymentFinalized={(step) => finalizeStripeInternalCheckout({
                                                                    subscriptionId: step?.subscriptionId || null,
                                                                    paymentMethodId: step?.paymentMethodId || null,
                                                                    paymentIntentId: step?.paymentIntentId || null,
                                                                    saveCard: step?.saveCard,
                                                                })}
                                                                />
                                                            </div>
                                                        )
                                                    ) : (
                                                        <div className="rounded-[2rem] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121528] p-6">
                                                            <p className="text-sm font-bold text-slate-900 dark:text-white">VocÃª serÃ¡ levado para a tela segura da Stripe para informar o cartÃ£o e concluir a compra.</p>
                                                        </div>
                                                    )}

                                                    {!isUsingStripeSavedCard && (
                                                    <label className="flex items-center gap-3 p-4 bg-white dark:bg-[#1a1c2e] border border-slate-200 dark:border-slate-800 rounded-xl cursor-pointer transition-all group">
                                                        <div className="relative">
                                                            <input
                                                                type="checkbox"
                                                                checked={saveCard || stripeRequiresSavedCard}
                                                                disabled={stripeRequiresSavedCard}
                                                                onChange={(e) => setSaveCard(e.target.checked)}
                                                                className="sr-only peer"
                                                            />
                                                            <div className="w-10 h-6 bg-slate-300 dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 group-hover:text-indigo-700 dark:group-hover:text-white transition-colors">
                                                                Salvar este cartÃ£o para compras futuras
                                                                {stripeRequiresSavedCard && <span className="ml-1 font-extrabold text-indigo-600 dark:text-indigo-400">(NecessÃ¡rio para renovaÃ§Ã£o automÃ¡tica)</span>}
                                                            </span>
                                                            <span className="text-[10px] text-slate-500">
                                                                Ele aparecerÃ¡ em Dados Pessoais para reutilizaÃ§Ã£o rÃ¡pida nas prÃ³ximas compras.
                                                            </span>
                                                        </div>
                                                    </label>
                                                    )}

                                                    <label className="flex items-center gap-3 p-4 bg-white dark:bg-[#1a1c2e] border border-slate-200 dark:border-slate-800 rounded-xl cursor-pointer transition-all group">
                                                        <div className="relative">
                                                            <input
                                                                type="checkbox"
                                                                checked={autoRenew}
                                                                onChange={(e) => {
                                                                    const enabled = e.target.checked;
                                                                    setAutoRenew(enabled);
                                                                    if (enabled && !isUsingStripeSavedCard) {
                                                                        setSaveCard(true);
                                                                    }
                                                                }}
                                                                className="sr-only peer"
                                                            />
                                                            <div className="w-10 h-6 bg-slate-300 dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 group-hover:text-emerald-700 dark:group-hover:text-white transition-colors">RenovaÃ§Ã£o automÃ¡tica</span>
                                                            <span className="text-[10px] text-slate-500">
                                                                {autoRenew ? 'Sua assinatura continuarÃ¡ ativa e a cobranÃ§a serÃ¡ renovada automaticamente.' : 'Sua assinatura serÃ¡ encerrada no fim do ciclo atual.'}
                                                            </span>
                                                        </div>
                                                    </label>
                                                </div>
                                            ) : (
                                                <>
                                            {selectedMethod === 'credit_card' && (
                                                <div className="space-y-6">
                                                    {/* Premium Saved Cards Carousel */}
                                                    {savedCards.length > 0 && (
                                                        <div className="space-y-4">
                                                            <div className="flex items-center justify-between px-1">
                                                                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">CartÃµes Salvos</h3>
	                                                                <button onClick={() => {
	                                                                    if (!savedCardCheckoutSupported && !isUsingSavedCard) {
	                                                                        addToast(savedCardCheckoutBlockedMessage, 'info');
	                                                                        return;
	                                                                    }
	                                                                    setIsUsingSavedCard(!isUsingSavedCard);
	                                                                    if (isUsingSavedCard) {
	                                                                        setSelectedCard(null);
	                                                                        setIssuerId(null);
	                                                                        setPaymentData((prev) => ({ ...prev, cardCvv: '' }));
	                                                                    }
	                                                                }} className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest hover:underline transition-all">
                                                                    {isUsingSavedCard ? '+ Novo CartÃ£o' : ' Meus CartÃµes'}
                                                                </button>
                                                            </div>

                                                            {!savedCardCheckoutSupported && (
                                                                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[11px] font-semibold leading-relaxed text-amber-800">
                                                                    O checkout com cartao salvo do Mercado Pago exige credenciais de producao. Enquanto sua integracao estiver com chave <span className="font-black">TEST</span>, voce ainda pode salvar o cartao com seguranca, mas a reutilizacao dele no checkout ficara indisponivel.
                                                                </div>
                                                            )}

                                                            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-1 px-1">
                                                                {savedCards.map((card) => (
	                                                                    <button key={card.id || card.mp_card_id} onClick={() => {
	                                                                        if (!savedCardCheckoutSupported) {
	                                                                            addToast(savedCardCheckoutBlockedMessage, 'info');
	                                                                            return;
	                                                                        }
	                                                                        setSelectedCard(card);
	                                                                        setIsUsingSavedCard(true);
	                                                                        setPaymentMethodId(normalizePaymentMethodId(card.payment_method_id || card.brand));
	                                                                        setIssuerId(card.issuer_id ? String(card.issuer_id) : null);
	                                                                        setPaymentData((prev) => ({ ...prev, cardCvv: '' }));
	                                                                        updateInstallments(card.first_six_digits || card.bin, card.payment_method_id || card.brand);
	                                                                    }} disabled={!savedCardCheckoutSupported} className={`flex-shrink-0 w-64 p-5 rounded-[2rem] border-2 transition-all duration-300 relative overflow-hidden group ${selectedCard?.id === card.id && isUsingSavedCard ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl shadow-indigo-600/20' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-indigo-400'} ${!savedCardCheckoutSupported ? 'opacity-60 cursor-not-allowed' : ''}`}>
                                                                        {selectedCard?.id === card.id && isUsingSavedCard && <div className="absolute top-4 right-4"><CheckCircle2 size={18} className="text-white" /></div>}
                                                                        
                                                                        <div className="flex items-center gap-3 mb-6">
                                                                            <div className={`w-10 h-6 rounded flex items-center justify-center ${selectedCard?.id === card.id && isUsingSavedCard ? 'bg-white/20' : 'bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600'}`}>
                                                                                {getBrandIcon(card.brand) ? (
                                                                                    <img src={getBrandIcon(card.brand)!} alt={card.brand} className="h-3 w-5 object-contain" />
                                                                                ) : (
                                                                                    <CreditCard size={14} />
                                                                                )}
                                                                            </div>
                                                                            <span className="text-[10px] font-black uppercase tracking-widest">{card.brand}</span>
                                                                        </div>

                                                                        <div className="space-y-1">
                                                                            <div className="text-sm font-black tracking-widest">â€¢â€¢â€¢â€¢ â€¢â€¢â€¢â€¢ â€¢â€¢â€¢â€¢ {card.last_four_digits}</div>
                                                                            <div className="text-[9px] font-bold uppercase opacity-60">Expira em {String(card.exp_month).padStart(2, '0')}/{String(card.exp_year).slice(-2)}</div>
                                                                        </div>
                                                                    </button>
                                                                ))}
	                                                                <button onClick={() => {
	                                                                    setIsUsingSavedCard(false);
	                                                                    setSelectedCard(null);
	                                                                    setIssuerId(null);
	                                                                    setPaymentData((prev) => ({ ...prev, cardCvv: '' }));
	                                                                }} className={`flex-shrink-0 w-32 p-5 rounded-[2rem] border-2 border-dashed transition-all flex flex-col items-center justify-center gap-3 group ${!isUsingSavedCard ? 'bg-indigo-50 dark:bg-indigo-500/5 border-indigo-400 text-indigo-600' : 'bg-transparent border-slate-200 dark:border-slate-700 text-slate-400'}`}>
                                                                    <Plus size={24} />
                                                                    <span className="text-[9px] font-black uppercase tracking-widest">Novo</span>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                    
                                                    {!isUsingSavedCard ? (
                                                        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                                                            <div className="space-y-2">
                                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nome no CartÃ£o</label>
                                                                <div className="relative">
                                                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                                                    <input type="text" placeholder="COMO ESTÃ IMPRESSO" value={paymentData.cardHolder} onChange={e => setPaymentData({ ...paymentData, cardHolder: e.target.value.toUpperCase() })} className="w-full h-14 pl-12 pr-4 bg-white dark:bg-[#0f1020] border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white font-bold outline-none focus:border-indigo-500 transition-all placeholder:text-slate-400 uppercase tracking-widest text-xs" />
                                                                </div>
                                                            </div>
                                                            
                                                            <div className="space-y-2">
                                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Dados do CartÃ£o</label>
                                                                <div className="relative">
                                                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                                        {getBrandIcon(paymentMethodId) ? (
                                                                            <img src={getBrandIcon(paymentMethodId)!} alt={paymentMethodId} className="h-4 w-6 object-contain" />
                                                                        ) : (
                                                                            <CreditCard className="text-slate-400" size={18} />
                                                                        )}
                                                                    </div>
                                                                    <input type="text" placeholder="0000 0000 0000 0000" value={paymentData.cardNumber} onChange={e => {
                                                                        let val = e.target.value.replace(/\D/g, '');
                                                                        if (val.length > 16) val = val.slice(0, 16);
                                                                        let formatted = val.match(/.{1,4}/g)?.join(' ') || val;
                                                                        setPaymentData({ ...paymentData, cardNumber: formatted });
                                                                    }} className="w-full h-14 pl-14 pr-4 bg-white dark:bg-[#0f1020] border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white font-bold outline-none focus:border-indigo-500 transition-all placeholder:text-slate-400 tracking-widest text-xs" />
                                                                </div>
                                                            </div>
                                                            
                                                            <div className="grid grid-cols-2 gap-4">
                                                                <div className="space-y-1">
                                                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Validade</label>
                                                                    <div className="relative">
                                                                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                                                        <input type="text" placeholder="MM/AA" maxLength={5} value={paymentData.cardExpiry} onChange={e => handleExpiryChange(e.target.value)} className="w-full h-14 pl-12 pr-4 bg-white dark:bg-[#0f1020] border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white font-bold outline-none focus:border-indigo-500 transition-all placeholder:text-slate-400 tracking-widest text-xs" />
                                                                    </div>
                                                                </div>
                                                                <div className="space-y-1">
                                                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">CVV</label>
                                                                    <div className="relative">
                                                                        <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                                                        <input type="text" placeholder="123" maxLength={4} value={paymentData.cardCvv} onChange={e => setPaymentData({ ...paymentData, cardCvv: e.target.value.replace(/\D/g, '') })} className="w-full h-14 pl-12 pr-4 bg-white dark:bg-[#0f1020] border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white font-bold outline-none focus:border-indigo-500 transition-all placeholder:text-slate-400 tracking-widest text-xs" />
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="space-y-2">
                                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">CPF do Titular</label>
                                                                <div className="relative">
                                                                    <Fingerprint className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                                                    <input type="text" placeholder="000.000.000-00" value={paymentData.cpf} onChange={e => {
                                                                        let val = e.target.value.replace(/\D/g, '');
                                                                        if (val.length > 11) val = val.slice(0, 11);
                                                                        let formatted = val;
                                                                        if (val.length > 9) formatted = val.match(/(\d{3})(\d{3})(\d{3})(\d{2})/)?.slice(1).join('.') || val;
                                                                        else if (val.length > 6) formatted = val.match(/(\d{3})(\d{3})(.*)/)?.slice(1).join('.') || val;
                                                                        else if (val.length > 3) formatted = val.match(/(\d{3})(.*)/)?.slice(1).join('.') || val;
                                                                        setPaymentData({ ...paymentData, cpf: formatted.replace(/\.(\d{2})$/, '-$1') });
                                                                    }} className="w-full h-14 pl-12 pr-4 bg-white dark:bg-[#0f1020] border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white font-bold outline-none focus:border-indigo-500 transition-all placeholder:text-slate-400 tracking-widest text-xs" />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="p-8 bg-indigo-600/5 dark:bg-indigo-500/5 border border-dashed border-indigo-200 dark:border-indigo-500/30 rounded-[2rem] flex flex-col items-center gap-6 text-center animate-in zoom-in-95 duration-500">
                                                            <div className="w-16 h-16 bg-white dark:bg-[#1a1c2e] rounded-3xl flex items-center justify-center shadow-2xl relative">
                                                                <Lock className="text-indigo-600" size={24} />
                                                                <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white dark:border-[#1a1c2e]"></div>
                                                            </div>
                                                            <div>
                                                                <div className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-[0.2em] mb-2">ConfirmaÃ§Ã£o de SeguranÃ§a</div>
                                                                <p className="text-[10px] text-slate-500 uppercase font-bold leading-relaxed max-w-[240px]">Para sua proteÃ§Ã£o, insira o CVV do cartÃ£o final <span className="text-indigo-600 font-black">{selectedCard?.last_four_digits}</span> para autorizar o pagamento.</p>
                                                            </div>
                                                            <div className="w-40 space-y-2">
                                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">CÃ³digo CVV</label>
                                                                <div className="relative h-14 bg-white dark:bg-[#0f1020] border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-none overflow-hidden">
                                                                    <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 z-10 pointer-events-none" size={18} />
                                                                    <div
                                                                        id="saved-card-security-code-container"
                                                                        onClick={() => savedCardSecurityFieldRef.current?.focus?.()}
                                                                        className="h-full w-full pl-12 pr-4 flex items-center cursor-text"
                                                                    />
                                                                </div>
                                                                {savedCardSecurityError && <p className="text-[10px] text-rose-500 font-bold leading-tight">{savedCardSecurityError}</p>}
                                                                {!savedCardSecurityError && <p className="text-[10px] text-slate-500 font-bold leading-tight">Digite o CVV do cartao salvo para confirmar esta compra.</p>}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {!isUsingSavedCard && (
                                                    <div className="pt-2">
                                                        <label className="flex items-center gap-3 p-4 bg-indigo-50/50 dark:bg-indigo-500/5 border border-indigo-100 dark:border-slate-700 rounded-xl cursor-pointer transition-all group">
                                                            <div className="relative">
                                                                <input type="checkbox" checked={saveCard || requiresSavedCard} disabled={requiresSavedCard} onChange={(e) => setSaveCard(e.target.checked)} className="sr-only peer" />
                                                                <div className="w-10 h-6 bg-slate-300 dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 group-hover:text-indigo-700 dark:group-hover:text-white transition-colors">Salvar este cartÃ£o para compras futuras {isRecurring && <span className="text-indigo-600 dark:text-indigo-400 font-extrabold ml-1">(Ativo na RecorrÃªncia)</span>}{!isRecurring && autoRenew && !isUsingSavedCard && <span className="text-indigo-600 dark:text-indigo-400 font-extrabold ml-1">(NecessÃ¡rio para renovaÃ§Ã£o automÃ¡tica)</span>}</span>
                                                                <span className="text-[10px] text-slate-500">Seus dados serÃ£o criptografados de ponta a ponta.</span>
                                                            </div>
                                                        </label>
                                                    </div>
                                                    )}

                                                    <div className="pt-2">
                                                        <label className="flex items-center gap-3 p-4 bg-white dark:bg-[#1a1c2e] border border-slate-200 dark:border-slate-800 rounded-xl cursor-pointer transition-all group">
                                                            <div className="relative">
                                                                <input type="checkbox" checked={autoRenew} onChange={(e) => {
                                                                    const enabled = e.target.checked;
                                                                    setAutoRenew(enabled);
                                                                    if (enabled && !isUsingSavedCard) {
                                                                        setSaveCard(true);
                                                                    }
                                                                }} className="sr-only peer" />
                                                                <div className="w-10 h-6 bg-slate-300 dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 group-hover:text-emerald-700 dark:group-hover:text-white transition-colors">RenovaÃ§Ã£o automÃ¡tica</span>
                                                                <span className="text-[10px] text-slate-500">
                                                                    {autoRenew
                                                                        ? 'Quando sua assinatura vencer, tentaremos renovar usando o cartÃ£o salvo de forma segura.'
                                                                        : 'Sua assinatura ficarÃ¡ com renovaÃ§Ã£o manual. VocÃª poderÃ¡ contratar novamente depois.'}
                                                                </span>
                                                            </div>
                                                        </label>
                                                    </div>

                                                    {systemSettings?.features?.recurringEnabled && maxInstallments > 1 && (
                                                        <div className="pt-2">
                                                            <div className={`p-4 rounded-xl border-2 transition-all ${isRecurring ? 'bg-indigo-50 dark:bg-indigo-600/10 border-indigo-600 dark:border-indigo-500' : 'bg-white dark:bg-[#1a1c2e] border-slate-200 dark:border-slate-800'}`}>
                                                                <label className="flex items-start gap-4 cursor-pointer">
                                                                    <div className="relative mt-1">
                                                                        <input type="checkbox" checked={isRecurring} onChange={(e) => { const val = e.target.checked; setIsRecurring(val); if (val) { setSelectedMethod('credit_card'); setSaveCard(true); setAutoRenew(true); setPaymentData(p => ({ ...p, installments: '1' })); } }} className="sr-only peer" />
                                                                        <div className="w-10 h-6 bg-slate-300 dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-full after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                                                    </div>
                                                                    <div className="flex-1 space-y-1">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest">Ativar Modo RecorrÃªncia</span>
                                                                            <span className="px-2 py-0.5 bg-indigo-600 text-white text-[8px] font-black uppercase rounded-full">Recomendado</span>
                                                                        </div>
                                                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Pague apenas R$ {(plan.price / maxInstallments).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} mensais sem comprometer o limite total do cartÃ£o.</p>
                                                                    </div>
                                                                </label>
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{isRecurring ? 'OpÃ§Ãµes de Parcelamento (1x na RecorrÃªncia)' : 'OpÃ§Ãµes de Parcelamento'}</label>
                                                        <select disabled={isRecurring} value={paymentData.installments} onChange={e => setPaymentData({ ...paymentData, installments: e.target.value })} className={`w-full h-12 px-4 bg-white dark:bg-[#1a1c2e] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-bold outline-none focus:border-indigo-500 transition-all ${isRecurring ? 'opacity-50' : ''}`}>
                                                            {isRecurring ? (
                                                                <option value="1">1x de R$ {(plan.price / maxInstallments).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} s/ juros (Assinatura)</option>
                                                            ) : ( installmentOptions.length > 0 ? (
                                                                installmentOptions.map((opt: any) => <option key={opt.installments} value={opt.installments}>{opt.recommended_message}</option>)
                                                            ) : ( [1,2,3,4,5,6,7,8,9,10,11,12].slice(0, maxInstallments).map(n => <option key={n} value={n}>{n}x de R$ {(plan.price / n).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</option>) ) )}
                                                        </select>
                                                    </div>
                                                </div>
                                            )}

                                            {(selectedMethod === 'pix' || selectedMethod === 'boleto') && (
                                                <div className="space-y-6">
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nome Completo</label>
                                                        <input type="text" placeholder="Seu nome completo" value={paymentData.payerName} onChange={e => setPaymentData({ ...paymentData, payerName: e.target.value })} className="w-full h-12 px-4 bg-white dark:bg-[#1a1c2e] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-bold outline-none focus:border-indigo-500" />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">CPF</label>
                                                        <input type="text" placeholder="000.000.000-00" value={paymentData.cpf} onChange={e => setPaymentData({ ...paymentData, cpf: e.target.value })} className="w-full h-12 px-4 bg-white dark:bg-[#1a1c2e] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-bold outline-none focus:border-indigo-500" />
                                                    </div>
                                                    <div className="p-5 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 rounded-2xl flex items-center gap-4">
                                                        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shrink-0">
                                                            {selectedMethod === 'pix' ? <QrCode size={20} /> : <FileText size={20} />}
                                                        </div>
                                                        <p className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 leading-tight">
                                                            {selectedMethod === 'pix' ? 'Pagamento instantÃ¢neo. A confirmaÃ§Ã£o ocorre em poucos segundos via QR Code ou Copia e Cola.' : 'Boleto bancÃ¡rio. A compensaÃ§Ã£o pode levar atÃ© 48h Ãºteis.'}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                                </>
                                            )}
                                        </div>

                                        {/* Coupon Integration */}
                                        <div className="pt-2">
                                            <div className="flex flex-col md:flex-row gap-3">
                                                <input type="text" value={couponCode} onChange={e => setCouponCode(e.target.value.toUpperCase())} placeholder="Cupom de desconto" className="flex-1 h-12 px-5 bg-slate-50 dark:bg-[#0f1020] border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-black text-slate-900 dark:text-white outline-none focus:border-indigo-500 transition-all placeholder:text-slate-400" />
                                                <button onClick={handleApplyCoupon} disabled={isApplyingCoupon || !couponCode} className="h-12 px-6 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 disabled:opacity-50 text-slate-700 dark:text-slate-300 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all">
                                                    {isApplyingCoupon ? 'Aplicando...' : 'Aplicar'}
                                                </button>
                                            </div>
                                            {appliedCoupon && (
                                                <div className="mt-3 flex items-center justify-between px-4 py-2 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 rounded-xl">
                                                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                                                        <Award size={14} />
                                                        <span className="text-[10px] font-black uppercase tracking-widest">Cupom "{appliedCoupon.code}" aplicado!</span>
                                                    </div>
                                                    <button onClick={() => { setAppliedCoupon(null); setDiscountAmount(0); }} className="text-[8px] font-black text-rose-500 uppercase tracking-widest hover:underline">Remover</button>
                                                </div>
                                            )}
                                        </div>

                                        {currentUser && getMissingCheckoutRequirements().length > 0 && (
                                            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 dark:border-amber-500/20 dark:bg-amber-500/10">
                                                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                                    <div className="space-y-1">
                                                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-700 dark:text-amber-300">Compra bloqueada</p>
                                                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                                            Complete seu perfil e confirme o e-mail antes de concluir o pagamento.
                                                        </p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowCheckoutRequirementsModal(true)}
                                                        className="h-11 rounded-xl bg-slate-900 px-4 text-[10px] font-black uppercase tracking-[0.2em] text-white transition-all hover:bg-slate-800 dark:bg-amber-500 dark:text-slate-900"
                                                    >
                                                        Resolver agora
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Final Action */}
                                        <div className="pt-6 border-t border-slate-200 dark:border-slate-800 space-y-4">
                                            {!isStripeInternalCheckout && (
                                                <button onClick={handlePayment} disabled={processing} className="w-full h-16 bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] rounded-2xl text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-500/20 transition-all flex items-center justify-center gap-3">
                                                    {processing ? (
                                                        <span className="flex items-center gap-2 animate-pulse">{processingLabel}</span>
                                                    ) : (
                                                        <>
                                                            {paymentActionLabel}
                                                            <ArrowRight size={20} />
                                                        </>
                                                    )}
                                                </button>
                                            )}

                                            <div className="flex items-center justify-center gap-2 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                                                <Shield size={14} />
                                                <span>Pagamento protegido e acesso liberado assim que aprovado.</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                            </div>
                        )}

                        {step === 'success' && renderSuccessStep()}

                        {false && step === 'success' && (
                            <div className="bg-white dark:bg-[#1a1c2e] border border-slate-200 dark:border-slate-800 rounded-[2rem] p-12 shadow-2xl animate-in zoom-in-95 duration-700 text-center space-y-8">
                                <div className="relative mx-auto w-32 h-32">
                                    <div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping"></div>
                                    <div className="relative w-full h-full bg-emerald-500 rounded-full flex items-center justify-center text-white shadow-2xl shadow-emerald-500/40 transform scale-110">
                                        <CheckCircle2 size={64} />
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <h2 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Pagamento Aprovado!</h2>
                                    <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto font-medium">ParabÃ©ns! Sua assinatura do plano <span className="text-indigo-600 dark:text-indigo-400 font-black">{displayName}</span> foi ativada com sucesso.</p>
                                </div>
                                <div className="pt-4 flex flex-col items-center gap-4">
                                    <button onClick={() => navigate('/profile?tab=billing')} className="px-12 py-5 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-[0.2em] text-[10px] rounded-2xl shadow-xl shadow-indigo-500/20 transition-all hover:-translate-y-1">ComeÃ§ar Agora</button>
                                    <div className="text-[10px] text-slate-400 uppercase tracking-widest font-black flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></div>
                                        Redirecionando automaticamente em {countdown} segundos...
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {step !== 'success' && (
                        <div className="lg:col-span-1 space-y-6 animate-in fade-in slide-in-from-right-4 duration-1000">
                            <div className="bg-white dark:bg-[#1a1c2e] border border-slate-200 dark:border-slate-800 rounded-[2rem] p-8 shadow-2xl sticky top-8 transition-all hover:shadow-indigo-500/10">
                                <h2 className="text-sm font-black text-slate-900 dark:text-white mb-8 flex items-center gap-3 uppercase tracking-[0.2em] border-b border-slate-100 dark:border-slate-800 pb-4">
                                    <div className="w-8 h-8 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg flex items-center justify-center text-emerald-600 dark:text-emerald-400"><Lock size={16} /></div>
                                    Resumo do Pedido
                                </h2>
                                
                                <div className="space-y-5 text-xs">
                                    <div className="flex justify-between items-center group">
                                        <span className="text-slate-500 uppercase font-bold tracking-widest">Plano Selecionado</span>
                                        <span className="text-slate-900 dark:text-white font-black">{displayName}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-500 uppercase font-bold tracking-widest">Ciclo</span>
                                        <span className="px-3 py-1 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg font-black uppercase tracking-tighter">{billingCycle}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-500 uppercase font-bold tracking-widest">Pagamento</span>
                                        <span className="text-slate-900 dark:text-white font-black">{selectedMethodLabel}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-500 uppercase font-bold tracking-widest">Cobranca</span>
                                        <span className="text-right text-slate-900 dark:text-white font-black">{checkoutBillingLabel}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-500 uppercase font-bold tracking-widest">RenovaÃ§Ã£o</span>
                                        <span className="text-slate-900 dark:text-white font-black">{renewalLabel}</span>
                                    </div>
                                    
                                    <div className="h-px bg-slate-100 dark:bg-slate-800 my-2"></div>
                                    
                                    <div className="flex justify-between items-center"><span className="text-slate-500 font-medium">Subtotal</span><span className="text-slate-900 dark:text-white font-bold">R$ {plan.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                                    
                                    {!isStripeProvider && !isRecurring && selectedInstallment.installments > 1 && (
                                        <div className="flex justify-between items-center text-slate-500 italic">
                                            <span>Parcelamento ({selectedInstallment.installments}x)</span>
                                            <span>R$ {selectedInstallment.installment_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mÃªs</span>
                                        </div>
                                    )}
                                    
                                    {proRatedCredit > 0 && <div className="flex justify-between items-center text-emerald-600 font-bold"><span>CrÃ©dito MigraÃ§Ã£o</span><span>- R$ {proRatedCredit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>}
                                    {discountAmount > 0 && <div className="flex justify-between items-center text-emerald-600 font-bold"><span>Desconto Aplicado</span><span>- R$ {discountAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>}
                                    <div className="flex justify-between items-center text-slate-500">
                                        <span>Gateway</span>
                                        <span className="font-bold text-slate-900 dark:text-white">{paymentProviderLabel}</span>
                                    </div>
                                    
                                    <div className="pt-6 mt-6 border-t border-slate-100 dark:border-slate-800 space-y-3">
                                        <div className="flex justify-between items-end">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isStripeProvider && supportsStripeBillingChoices && selectedStripeInstallmentCount > 1 ? 'Primeira cobranca' : 'Total a pagar'}</span>
                                                <span className="text-[9px] text-slate-400 italic">
                                                    {isStripeProvider && supportsStripeBillingChoices && selectedStripeInstallmentCount > 1
                                                        ? `Cobranca ${selectedStripeInstallmentCount}x do plano contratado`
                                                        : 'Valor final desta cobranca'}
                                                </span>
                                            </div>
                                            <div className="flex flex-col items-end">
                                                <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 tracking-tighter">R$ {monetaryTotals.totalDue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </div>
                    )}
                </div>
            </div>

            {showDowngradeModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-sm">
                    <div className="bg-slate-900 w-full max-w-lg rounded-3xl p-8 border border-slate-800 text-center space-y-6">
                        <div className="w-20 h-20 bg-amber-500/10 rounded-2xl flex items-center justify-center mx-auto"><AlertTriangle size={40} className="text-amber-500" /></div>
                        <h3 className="text-xl font-black text-white uppercase tracking-tight">Aviso de Downgrade</h3>
                        <p className="text-sm text-slate-400 leading-relaxed">VocÃª estÃ¡ mudando para um plano inferior. BenefÃ­cios exclusivos do seu plano atual (<span className="text-indigo-400 font-bold">{currentUser?.subscription?.plan?.name}</span>) serÃ£o perdidos na prÃ³xima renovaÃ§Ã£o.</p>
                        <button onClick={() => setShowDowngradeModal(false)} className="w-full py-4 bg-white text-slate-900 rounded-xl font-black uppercase tracking-widest">Entendi e quero continuar</button>
                    </div>
                </div>
            )}

            {showCheckoutRequirementsModal && currentUser && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
                        onClick={() => setShowCheckoutRequirementsModal(false)}
                    />
                    <div className="relative z-10 w-full max-w-3xl rounded-[2rem] border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-[#1a1c2e] md:p-8">
                        <div className="flex flex-col gap-3 border-b border-slate-100 pb-5 dark:border-slate-800 md:flex-row md:items-start md:justify-between">
                            <div className="space-y-2">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Checkout seguro</p>
                                <h3 className="text-2xl font-black text-slate-900 dark:text-white">Complete seu cadastro para pagar</h3>
                                <p className="max-w-2xl text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                                    Antes de concluir a compra, precisamos dos seus dados de cobranca e de uma conta com e-mail confirmado.
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

                        <div className="mt-6 space-y-6">
                            <div className={`rounded-[1.5rem] border px-5 py-4 ${currentUser.emailVerified ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-500/10' : 'border-amber-200 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/10'}`}>
                                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Confirmacao de e-mail</p>
                                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                            {currentUser.emailVerified ? 'Seu e-mail ja esta confirmado.' : 'Confirme seu e-mail para liberar o pagamento.'}
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
                                            Ja confirmei
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Nome completo</label>
                                    <input
                                        type="text"
                                        value={checkoutRequirementData.name}
                                        onChange={(event) => handleCheckoutRequirementFieldChange('name', event.target.value)}
                                        className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none transition-all focus:border-indigo-500 dark:border-slate-700 dark:bg-[#0f1020] dark:text-white"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">CPF</label>
                                    <input
                                        type="text"
                                        value={checkoutRequirementData.cpf}
                                        onChange={(event) => handleCheckoutRequirementFieldChange('cpf', event.target.value)}
                                        className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none transition-all focus:border-indigo-500 dark:border-slate-700 dark:bg-[#0f1020] dark:text-white"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">CEP</label>
                                    <input
                                        type="text"
                                        value={checkoutRequirementData.zipCode}
                                        onChange={(event) => handleCheckoutRequirementFieldChange('zipCode', event.target.value)}
                                        className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none transition-all focus:border-indigo-500 dark:border-slate-700 dark:bg-[#0f1020] dark:text-white"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Logradouro</label>
                                    <input
                                        type="text"
                                        value={checkoutRequirementData.street}
                                        onChange={(event) => handleCheckoutRequirementFieldChange('street', event.target.value)}
                                        className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none transition-all focus:border-indigo-500 dark:border-slate-700 dark:bg-[#0f1020] dark:text-white"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Numero</label>
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
                                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Bairro</label>
                                    <input
                                        type="text"
                                        value={checkoutRequirementData.neighborhood}
                                        onChange={(event) => handleCheckoutRequirementFieldChange('neighborhood', event.target.value)}
                                        className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none transition-all focus:border-indigo-500 dark:border-slate-700 dark:bg-[#0f1020] dark:text-white"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Cidade</label>
                                    <input
                                        type="text"
                                        value={checkoutRequirementData.city}
                                        onChange={(event) => handleCheckoutRequirementFieldChange('city', event.target.value)}
                                        className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none transition-all focus:border-indigo-500 dark:border-slate-700 dark:bg-[#0f1020] dark:text-white"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">UF</label>
                                <input
                                    type="text"
                                    maxLength={2}
                                    value={checkoutRequirementData.state}
                                    onChange={(event) => handleCheckoutRequirementFieldChange('state', event.target.value.toUpperCase())}
                                    className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold uppercase text-slate-900 outline-none transition-all focus:border-indigo-500 dark:border-slate-700 dark:bg-[#0f1020] dark:text-white"
                                />
                            </div>
                        </div>

                        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
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
        </div>
    );
};

export default CheckoutPage;
