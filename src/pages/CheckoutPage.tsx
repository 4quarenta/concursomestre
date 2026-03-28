import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { planService } from '../features/plans/services/planService';
import { Plan } from '../../types';
import {
    CheckCircle2, ShieldCheck, ArrowRight, ArrowLeft, CreditCard,
    Lock, User, Mail, UserPlus, LogIn, ChevronRight, QrCode, FileText, Calendar, ToggleRight, ToggleLeft, AlertTriangle, XCircle,
    Award, Zap, Globe, Shield, Plus, History, Fingerprint
} from 'lucide-react';
import { SecurityCode, createCardToken as createSecureCardToken, getInstallments, getIssuers, getPaymentMethods, initMercadoPago } from '@mercadopago/sdk-react';
import { apiClient, ENDPOINTS } from '../core/api';
import ReCAPTCHA from 'react-google-recaptcha';

type CheckoutStep = 'identification' | 'payment' | 'success';
type AuthMode = 'login' | 'register';
type PaymentMethod = 'credit_card' | 'pix' | 'boleto';

declare global {
    interface Window {
        MercadoPago: any;
        securityCodeInstance?: {
            focus?: () => void;
            blur?: () => void;
            unmount?: () => void;
        };
    }
}

const CheckoutPage: React.FC = () => {
    const { planId } = useParams<{ planId: string }>();
    const { currentUser, login, refreshUser } = useAuth();
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

    const isDevMode = systemSettings?.appMode !== 'production';
    const MP_PUBLIC_KEY = systemSettings?.mercadoPagoKey || 'TEST-1e38d560-c2b8-4a5c-8b12-bad17bb8a9ba';
    
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
    const [savedCardSecurityError, setSavedCardSecurityError] = useState<string | null>(null);
    const requiresSavedCard = isRecurring || (autoRenew && !isUsingSavedCard);

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

    const handleSavedCardSecurityValidity = useCallback((errorMessages?: Array<{ message?: string }>) => {
        const nextError = errorMessages?.[0]?.message || null;
        setSavedCardSecurityError(nextError);
        setSavedCardSecurityReady(!nextError);
    }, []);

    const handleSavedCardSecurityReady = useCallback(() => {
        setSavedCardSecurityError(null);
        setSavedCardSecurityReady(false);
        window.setTimeout(() => {
            window.securityCodeInstance?.focus?.();
        }, 150);
    }, []);

    const handleSavedCardSecurityError = useCallback((error: any) => {
        setSavedCardSecurityReady(false);
        setSavedCardSecurityError(error?.message || error?.error || 'Não foi possível carregar o campo seguro do cartão.');
    }, []);

    const handleSavedCardSecurityChange = useCallback(({ errorMessages }: any) => {
        handleSavedCardSecurityValidity(errorMessages);
    }, [handleSavedCardSecurityValidity]);

    const savedCardSecurityStyle = useMemo(() => ({
        fontSize: '18px',
        fontWeight: '700',
        color: '#0f172a',
        padding: '0',
        height: '100%',
        width: '100%',
    }), []);

    const focusSavedCardSecurityCode = useCallback(() => {
        window.securityCodeInstance?.focus?.();
    }, []);

    useEffect(() => {
        if (!planId) {
            navigate('/plans');
            return;
        }
        loadPlan();
    }, [planId]);

    useEffect(() => {
        if (MP_PUBLIC_KEY) {
            initMercadoPago(MP_PUBLIC_KEY, {
                locale: 'pt-BR',
                trackingDisabled: true,
                advancedFraudPrevention: true,
            });
        }
    }, [MP_PUBLIC_KEY]);

    useEffect(() => {
        setSavedCardSecurityReady(false);
        setSavedCardSecurityError(null);
    }, [isUsingSavedCard, selectedCard?.id]);

    useEffect(() => {
        if (selectedMethod !== 'credit_card' && isRecurring) {
            setIsRecurring(false);
        }
    }, [selectedMethod, isRecurring]);

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
            const response = await apiClient.get<any>('payments/get-installments.php', {
                params: { 
                    amount: plan?.price, 
                    bin,
                    payment_method_id: normalizedPaymentMethodId || undefined
                }
            });

            const data = response.data?.data || response.data || response;

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
                            addToast(`Você já possui o plano ${currentUser.subscription.plan?.name || 'Premium'}. Não é possível assinar um plano inferior ou igual enquanto o atual estiver ativo.`, 'warning');
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
        if (!currentUser) return;
        try {
            if (import.meta.env.DEV) console.log('💳 Fetching saved cards for user:', currentUser.id);
            const res = await apiClient.post('users/list_cards.php', { user_id: currentUser.id }) as any;
            
            if (import.meta.env.DEV) console.log('💳 Cards API Response:', res);

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
                if (import.meta.env.DEV) console.warn('💳 No saved cards found or error in response:', res);
            }
        } catch (e) {
            console.error('Error fetching cards:', e);
        }
    };

    useEffect(() => {
        if (currentUser) {
            loadSavedCards();
        }
    }, [currentUser]);

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
            loadSavedCards();
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
                    addToast('As senhas não coincidem.', 'error');
                    setAuthLoading(false);
                    return;
                }

                if (!captchaToken && !isDevMode) {
                    addToast('Por favor, complete o desafio de segurança.', 'error');
                    setAuthLoading(false);
                    return;
                }

                const searchParams = new URLSearchParams(location.search);
                const referralCode = searchParams.get('ref') || searchParams.get('referral');

                const result: any = await apiClient.post(ENDPOINTS.auth.register, {
                    name: formData.name.trim(),
                    email: formData.email.trim(),
                    password: formData.password,
                    captchaToken,
                    referralCode
                });

                if (result.success && result.data) {
                    const { user, token } = result.data;
                    localStorage.setItem('token', token);
                    localStorage.setItem('user', JSON.stringify(user));
                    login(user);
                    addToast('Conta criada com sucesso e login realizado!', 'success');
                } else {
                    addToast(result.message || 'Erro ao criar conta.', 'error');
                    if (recaptchaRef.current) recaptchaRef.current.reset();
                    setCaptchaToken(null);
                }

            } else {
                if (!captchaToken && !isDevMode) {
                    addToast('Por favor, complete o desafio de segurança.', 'error');
                    setAuthLoading(false);
                    return;
                }

                const result: any = await apiClient.post(ENDPOINTS.auth.login, {
                    email: formData.email,
                    password: formData.password,
                    captchaToken
                });

                if (result.success && result.data) {
                    const { user, token } = result.data;
                    localStorage.setItem('token', token);
                    localStorage.setItem('user', JSON.stringify(user));
                    login(user);
                    addToast('Login realizado com sucesso!', 'success');
                } else {
                    addToast(result.message || 'Credenciais inválidas.', 'error');
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
            const response: any = await apiClient.post('subscriptions/validate_coupon.php', {
                code: couponCode,
                plan_id: plan?.id,
                amount: plan?.price
            });

            if (response.success && response.coupon) {
                setAppliedCoupon(response.coupon);
                setDiscountAmount(Number(response.coupon.discount_amount || 0));
                addToast('Cupom aplicado com sucesso!', 'success');
            } else {
                addToast(response.message || 'Cupom inválido ou expirado.', 'error');
                setAppliedCoupon(null);
                setDiscountAmount(0);
            }
        } catch (err) {
            addToast('Erro ao validar cupom.', 'error');
        } finally {
            setIsApplyingCoupon(false);
        }
    };

    const handlePayment = async () => {
        if (!plan || !currentUser) return;

        if (selectedMethod === 'credit_card') {
            if (isUsingSavedCard) {
                if (!selectedCard) {
                    addToast('Selecione um cartão para continuar.', 'warning');
                    return;
                }
                if (!savedCardSecurityReady) {
                    addToast(savedCardSecurityError || 'Preencha o código de segurança do cartão salvo.', 'warning');
                    return;
                }
            } else if (!paymentData.cardNumber || !paymentData.cardHolder || !paymentData.cardExpiry || !paymentData.cardCvv || !paymentData.cpf) {
                addToast('Preencha todos os dados do cartão.', 'error');
                return;
            }
        } else {
            if (!paymentData.payerName || !paymentData.cpf) {
                addToast('Preencha os dados do pagador.', 'error');
                return;
            }
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
                        const cardTokenRes = await createSecureCardToken({
                            cardId: selectedCard.mp_card_id,
                        });
                        
                        if (!cardTokenRes || !cardTokenRes.id) {
                            throw new Error('Erro ao validar o cartão salvo com o Mercado Pago. Verifique o código de segurança.');
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
                            throw new Error('Erro ao gerar token de segurança do cartão. Verifique os dados.');
                        }

                        cardToken    = cardTokenRes.id;
                        cardLastFour = paymentData.cardNumber.replace(/\s/g, '').slice(-4);
                        cardBin = (cardTokenRes.first_six_digits || paymentData.cardNumber.replace(/\D/g, '').slice(0, 8)).toString();
                    }
                } catch (tkErr: any) {
                    console.error('Tokenization error:', tkErr);
                    throw new Error(tkErr.message || 'Falha na comunicação segura com o Mercado Pago.');
                }

                const installments = isRecurring ? 1 : parseInt(paymentData.installments, 10);
                const resolvedPayment = await resolvePaymentMetadata({
                    bin: cardBin,
                    fallbackPaymentMethodId: isUsingSavedCard ? (selectedCard?.payment_method_id || selectedCard?.brand) : paymentMethodId,
                    fallbackIssuerId: isUsingSavedCard ? selectedCard?.issuer_id : issuerId,
                });

                if (!cardToken) {
                    throw new Error('Token do cartÃ£o ausente. A tokenizaÃ§Ã£o nÃ£o foi concluÃ­da.');
                }

                if (!resolvedPayment.paymentMethodId) {
                    throw new Error('NÃ£o foi possÃ­vel identificar o payment_method_id do cartÃ£o.');
                }

                if (!Number.isFinite(installments) || installments < 1) {
                    throw new Error('NÃºmero de parcelas invÃ¡lido para o pagamento.');
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
                        identification: {
                            type: 'CPF',
                            number: paymentData.cpf.replace(/\D/g, '')
                        }
                    }
                };

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
                        addToast('Cartão salvo com sucesso para compras futuras.', 'success');
                    }
                } else {
                    addToast(response.error || 'Pagamento recusado ou erro no processamento.', 'error');
                    setProcessing(false);
                }
            } else {
                addToast('Processamento via PIX/Boleto em breve. Use cartão de crédito.', 'info');
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

    const selectedInstallment = useMemo(() => {
        if (!plan) return { installments: 1, installment_amount: 0, total_amount: 0 };
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
    }, [plan, installmentOptions, paymentData.installments, isRecurring, maxInstallments]);

    const monetaryTotals = useMemo(() => {
        if (!plan) return { firstCharge: 0, totalDue: 0 };
        const discount = appliedCoupon ? discountAmount : 0;
        
        // Se for recorrente, baseamos no valor da parcela
        // Caso contrário, usamos o total_amount do parcelamento selecionado (que já inclui juros se houver)
        const baseAmount = isRecurring 
            ? (plan.price / maxInstallments) 
            : selectedInstallment.total_amount;

        const totalDue = Math.max(0, baseAmount - proRatedCredit - discount);
        return { firstCharge: baseAmount, totalDue };
    }, [plan, isRecurring, maxInstallments, proRatedCredit, appliedCoupon, discountAmount, selectedInstallment.total_amount]);

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
                        { id: 'identification' as CheckoutStep, label: 'Identificação' },
                        { id: 'payment' as CheckoutStep, label: 'Pagamento & Oferta' },
                        { id: 'success' as CheckoutStep, label: 'Confirmação' }
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
                                        <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Identificação</h2>
                                        <p className="text-sm text-slate-500">Acesse sua conta ou crie uma nova para continuar.</p>
                                    </div>

                                    <div className="flex bg-slate-100 dark:bg-[#0f1020] p-1.5 rounded-2xl">
                                        <button onClick={() => setAuthMode('register')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${authMode === 'register' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Criar Conta</button>
                                        <button onClick={() => setAuthMode('login')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${authMode === 'login' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Já tenho conta</button>
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
                                                <input type="password" required value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} className="w-full h-14 pl-12 pr-4 bg-slate-50 dark:bg-[#0f1020] border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-white font-bold outline-none focus:border-indigo-500 transition-all placeholder:text-slate-400" placeholder="••••••••" />
                                            </div>
                                        </div>
                                        {!isDevMode && <div className="flex justify-center py-2"><ReCAPTCHA ref={recaptchaRef} sitekey={systemSettings?.recaptchaSiteKey || ''} onChange={setCaptchaToken} theme={document.documentElement.classList.contains('dark') ? 'dark' : 'light'} /></div>}
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
                                                Pagamento & Oferta
                                            </h2>
                                            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 rounded-full">
                                                <ShieldCheck size={14} className="text-emerald-500" />
                                                <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Pague com Segurança</span>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <button onClick={() => setSelectedMethod('credit_card')} className={`p-5 rounded-2xl border-2 flex flex-col items-center gap-4 transition-all duration-300 ${selectedMethod === 'credit_card' ? 'bg-indigo-50 dark:bg-indigo-600/10 border-indigo-600 dark:border-indigo-500 text-indigo-700 dark:text-indigo-400 shadow-lg' : 'bg-slate-50 dark:bg-[#0f1020] border-slate-200 dark:border-slate-800 text-slate-400'}`}>
                                                <CreditCard size={28} />
                                                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Cartão</span>
                                            </button>
                                            <button disabled={isRecurring} onClick={() => setSelectedMethod('pix')} className={`p-5 rounded-2xl border-2 flex flex-col items-center gap-4 transition-all duration-300 ${selectedMethod === 'pix' ? 'bg-indigo-50 dark:bg-indigo-600/10 border-indigo-600 dark:border-indigo-500 text-indigo-700 dark:text-indigo-400 shadow-lg' : 'bg-slate-50 dark:bg-[#0f1020] border-slate-200 dark:border-slate-800 text-slate-400'} ${isRecurring ? 'opacity-40 cursor-not-allowed' : ''}`}>
                                                <QrCode size={28} />
                                                <span className="text-[10px] font-black uppercase tracking-[0.2em]">PIX</span>
                                            </button>
                                            <button disabled={isRecurring} onClick={() => setSelectedMethod('boleto')} className={`p-5 rounded-2xl border-2 flex flex-col items-center gap-4 transition-all duration-300 ${selectedMethod === 'boleto' ? 'bg-indigo-50 dark:bg-indigo-600/10 border-indigo-600 dark:border-indigo-500 text-indigo-700 dark:text-indigo-400 shadow-lg' : 'bg-slate-50 dark:bg-[#0f1020] border-slate-200 dark:border-slate-800 text-slate-400'} ${isRecurring ? 'opacity-40 cursor-not-allowed' : ''}`}>
                                                <FileText size={28} />
                                                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Boleto</span>
                                            </button>
                                        </div>

                                        <div className="bg-slate-100 dark:bg-[#0f1020] p-6 md:p-8 rounded-[2rem] border border-slate-200 dark:border-slate-800">
                                            {selectedMethod === 'credit_card' && (
                                                <div className="space-y-6">
                                                    {/* Premium Saved Cards Carousel */}
                                                    {savedCards.length > 0 && (
                                                        <div className="space-y-4">
                                                            <div className="flex items-center justify-between px-1">
                                                                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">Cartões Salvos</h3>
	                                                                <button onClick={() => {
	                                                                    setIsUsingSavedCard(!isUsingSavedCard);
	                                                                    if (isUsingSavedCard) {
	                                                                        setSelectedCard(null);
	                                                                        setIssuerId(null);
	                                                                        setPaymentData((prev) => ({ ...prev, cardCvv: '' }));
	                                                                    }
	                                                                }} className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest hover:underline transition-all">
                                                                    {isUsingSavedCard ? '+ Novo Cartão' : ' Meus Cartões'}
                                                                </button>
                                                            </div>
                                                            
                                                            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-1 px-1">
                                                                {savedCards.map((card) => (
	                                                                    <button key={card.id || card.mp_card_id} onClick={() => {
	                                                                        setSelectedCard(card);
	                                                                        setIsUsingSavedCard(true);
	                                                                        setPaymentMethodId(normalizePaymentMethodId(card.payment_method_id || card.brand));
	                                                                        setIssuerId(card.issuer_id ? String(card.issuer_id) : null);
	                                                                        setPaymentData((prev) => ({ ...prev, cardCvv: '' }));
	                                                                        updateInstallments(card.first_six_digits || card.bin, card.payment_method_id || card.brand);
	                                                                    }} className={`flex-shrink-0 w-64 p-5 rounded-[2rem] border-2 transition-all duration-300 relative overflow-hidden group ${selectedCard?.id === card.id && isUsingSavedCard ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl shadow-indigo-600/20' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-indigo-400'}`}>
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
                                                                            <div className="text-sm font-black tracking-widest">•••• •••• •••• {card.last_four_digits}</div>
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
                                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nome no Cartão</label>
                                                                <div className="relative">
                                                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                                                    <input type="text" placeholder="COMO ESTÁ IMPRESSO" value={paymentData.cardHolder} onChange={e => setPaymentData({ ...paymentData, cardHolder: e.target.value.toUpperCase() })} className="w-full h-14 pl-12 pr-4 bg-white dark:bg-[#0f1020] border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white font-bold outline-none focus:border-indigo-500 transition-all placeholder:text-slate-400 uppercase tracking-widest text-xs" />
                                                                </div>
                                                            </div>
                                                            
                                                            <div className="space-y-2">
                                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Dados do Cartão</label>
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
                                                                <div className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-[0.2em] mb-2">Confirmação de Segurança</div>
                                                                <p className="text-[10px] text-slate-500 uppercase font-bold leading-relaxed max-w-[240px]">Para sua proteção, insira o CVV do cartão final <span className="text-indigo-600 font-black">{selectedCard?.last_four_digits}</span> para autorizar o pagamento.</p>
                                                            </div>
                                                            <div className="w-40 space-y-2">
                                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Código CVV</label>
                                                                <div className="relative h-14 bg-white dark:bg-[#0f1020] border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-none overflow-hidden">
                                                                    <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 z-10 pointer-events-none" size={18} />
                                                                    <div className="h-full w-full pl-12 pr-4 flex items-center cursor-text" onClick={focusSavedCardSecurityCode}>
                                                                        <SecurityCode
                                                                            key={selectedCard?.id || selectedCard?.mp_card_id}
                                                                            placeholder="123"
                                                                            mode="mandatory"
                                                                            style={savedCardSecurityStyle}
                                                                            onReady={handleSavedCardSecurityReady}
                                                                            onError={handleSavedCardSecurityError}
                                                                            onValidityChange={handleSavedCardSecurityChange}
                                                                        />
                                                                    </div>
                                                                </div>
                                                                {savedCardSecurityError && <p className="text-[10px] text-rose-500 font-bold leading-tight">{savedCardSecurityError}</p>}
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div className="pt-2">
                                                        <label className="flex items-center gap-3 p-4 bg-indigo-50/50 dark:bg-indigo-500/5 border border-indigo-100 dark:border-slate-700 rounded-xl cursor-pointer transition-all group">
                                                            <div className="relative">
                                                                <input type="checkbox" checked={saveCard || requiresSavedCard} disabled={requiresSavedCard} onChange={(e) => setSaveCard(e.target.checked)} className="sr-only peer" />
                                                                <div className="w-10 h-6 bg-slate-300 dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 group-hover:text-indigo-700 dark:group-hover:text-white transition-colors">Salvar este cartão para compras futuras {isRecurring && <span className="text-indigo-600 dark:text-indigo-400 font-extrabold ml-1">(Ativo na Recorrência)</span>}{!isRecurring && autoRenew && !isUsingSavedCard && <span className="text-indigo-600 dark:text-indigo-400 font-extrabold ml-1">(Necessário para renovação automática)</span>}</span>
                                                                <span className="text-[10px] text-slate-500">Seus dados serão criptografados de ponta a ponta.</span>
                                                            </div>
                                                        </label>
                                                    </div>

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
                                                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 group-hover:text-emerald-700 dark:group-hover:text-white transition-colors">Renovação automática</span>
                                                                <span className="text-[10px] text-slate-500">
                                                                    {autoRenew
                                                                        ? 'Quando sua assinatura vencer, tentaremos renovar usando o cartão salvo de forma segura.'
                                                                        : 'Sua assinatura ficará com renovação manual. Você poderá contratar novamente depois.'}
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
                                                                            <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest">Ativar Modo Recorrência</span>
                                                                            <span className="px-2 py-0.5 bg-indigo-600 text-white text-[8px] font-black uppercase rounded-full">Recomendado</span>
                                                                        </div>
                                                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Pague apenas R$ {(plan.price / maxInstallments).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} mensais sem comprometer o limite total do cartão.</p>
                                                                    </div>
                                                                </label>
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{isRecurring ? 'Opções de Parcelamento (1x na Recorrência)' : 'Opções de Parcelamento'}</label>
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
                                                            {selectedMethod === 'pix' ? 'Pagamento instantâneo. A confirmação ocorre em poucos segundos via QR Code ou Copia e Cola.' : 'Boleto bancário. A compensação pode levar até 48h úteis.'}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Coupon Integration */}
                                        <div className="pt-2">
                                            <div className="flex flex-col md:flex-row gap-3">
                                                <input type="text" value={couponCode} onChange={e => setCouponCode(e.target.value.toUpperCase())} placeholder="TEM UM CUPOM?" className="flex-1 h-12 px-5 bg-slate-50 dark:bg-[#0f1020] border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-black text-slate-900 dark:text-white outline-none focus:border-indigo-500 transition-all placeholder:text-slate-400" />
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

                                        {/* Final Action */}
                                        <div className="pt-6 border-t border-slate-200 dark:border-slate-800 space-y-4">
                                            <button onClick={handlePayment} disabled={processing} className="w-full h-16 bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] rounded-2xl text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-500/20 transition-all flex items-center justify-center gap-3">
                                                {processing ? (
                                                    <span className="flex items-center gap-2 animate-pulse">Processando Segurança...</span>
                                                ) : (
                                                    <>
                                                        {isRecurring ? 'Ativar Assinatura Recorrente' : 'Finalizar Pagamento Seguro'} 
                                                        <ArrowRight size={20} />
                                                    </>
                                                )}
                                            </button>
                                            
                                            <div className="flex flex-wrap items-center justify-center gap-6 opacity-60 grayscale hover:grayscale-0 transition-all">
                                                <div className="flex items-center gap-1.5"><Shield size={14} /><span className="text-[8px] font-bold uppercase tracking-widest">SSL Secure</span></div>
                                                <div className="flex items-center gap-1.5"><Lock size={14} /><span className="text-[8px] font-bold uppercase tracking-widest">PCI Compliant</span></div>
                                                <div className="flex items-center gap-1.5"><Zap size={14} /><span className="text-[8px] font-bold uppercase tracking-widest">Instant Access</span></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Conversion Triggers & Social Proof */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-white dark:bg-[#1a1c2e] p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 flex items-start gap-4 transition-all hover:border-indigo-300 dark:hover:border-indigo-500/30">
                                        <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                                            <Award size={24} />
                                        </div>
                                        <div className="space-y-1">
                                            <h4 className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-widest">Garantia Incondicional</h4>
                                            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">Não gostou? Solicite reembolso em até 7 dias sem perguntas.</p>
                                        </div>
                                    </div>
                                    <div className="bg-white dark:bg-[#1a1c2e] p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 flex items-start gap-4 transition-all hover:border-indigo-300 dark:hover:border-indigo-500/30">
                                        <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                                            <Globe size={24} />
                                        </div>
                                        <div className="space-y-1">
                                            <h4 className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-widest">Comunidade VIP</h4>
                                            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">Junte-se a +10.000 alunos e acelere sua aprovação hoje.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {step === 'success' && (
                            <div className="bg-white dark:bg-[#1a1c2e] border border-slate-200 dark:border-slate-800 rounded-[2rem] p-12 shadow-2xl animate-in zoom-in-95 duration-700 text-center space-y-8">
                                <div className="relative mx-auto w-32 h-32">
                                    <div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping"></div>
                                    <div className="relative w-full h-full bg-emerald-500 rounded-full flex items-center justify-center text-white shadow-2xl shadow-emerald-500/40 transform scale-110">
                                        <CheckCircle2 size={64} />
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <h2 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Pagamento Aprovado!</h2>
                                    <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto font-medium">Parabéns! Sua assinatura do plano <span className="text-indigo-600 dark:text-indigo-400 font-black">{displayName}</span> foi ativada com sucesso.</p>
                                </div>
                                <div className="pt-4 flex flex-col items-center gap-4">
                                    <button onClick={() => navigate('/profile?tab=billing')} className="px-12 py-5 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-[0.2em] text-[10px] rounded-2xl shadow-xl shadow-indigo-500/20 transition-all hover:-translate-y-1">Começar Agora</button>
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
                                    
                                    <div className="h-px bg-slate-100 dark:bg-slate-800 my-2"></div>
                                    
                                    <div className="flex justify-between items-center"><span className="text-slate-500 font-medium">Subtotal</span><span className="text-slate-900 dark:text-white font-bold">R$ {plan.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                                    
                                    {!isRecurring && selectedInstallment.installments > 1 && (
                                        <div className="flex justify-between items-center text-slate-500 italic">
                                            <span>Parcelamento ({selectedInstallment.installments}x)</span>
                                            <span>R$ {selectedInstallment.installment_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês</span>
                                        </div>
                                    )}
                                    
                                    {proRatedCredit > 0 && <div className="flex justify-between items-center text-emerald-600 font-bold"><span>Crédito Migração</span><span>- R$ {proRatedCredit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>}
                                    {discountAmount > 0 && <div className="flex justify-between items-center text-emerald-600 font-bold"><span>Desconto Aplicado</span><span>- R$ {discountAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>}
                                    
                                    <div className="pt-6 mt-6 border-t border-slate-100 dark:border-slate-800 space-y-3">
                                        <div className="flex justify-between items-end">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total a Pagar</span>
                                                <span className="text-[9px] text-slate-400 italic">Preço final com taxas inclusas</span>
                                            </div>
                                            <div className="flex flex-col items-end">
                                                <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 tracking-tighter">R$ {monetaryTotals.totalDue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-col items-center gap-4">
                                    <div className="flex items-center gap-3 opacity-40 grayscale">
                                        <img src="https://logopng.com.br/logos/mercadopago-22.svg" alt="MercadoPago" className="h-4" />
                                        <div className="w-px h-3 bg-slate-300"></div>
                                        <ShieldCheck size={14} />
                                    </div>
                                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-[0.2em] text-center">Checkout transparente e seguro</p>
                                </div>
                            </div>

                            {/* Sticky Guarantee Callout */}
                            <div className="bg-indigo-600 rounded-[1.5rem] p-6 text-white shadow-xl shadow-indigo-600/20 space-y-3">
                                <div className="flex items-center gap-3">
                                    <Award size={20} className="text-indigo-200" />
                                    <span className="font-black text-xs uppercase tracking-widest">Compra Sem Risco</span>
                                </div>
                                <p className="text-[10px] text-indigo-100 leading-relaxed font-medium">Sua satisfação é nossa prioridade. Se não ficar satisfeito em 7 dias, devolvemos 100% do seu dinheiro.</p>
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
                        <p className="text-sm text-slate-400 leading-relaxed">Você está mudando para um plano inferior. Benefícios exclusivos do seu plano atual (<span className="text-indigo-400 font-bold">{currentUser?.subscription?.plan?.name}</span>) serão perdidos na próxima renovação.</p>
                        <button onClick={() => setShowDowngradeModal(false)} className="w-full py-4 bg-white text-slate-900 rounded-xl font-black uppercase tracking-widest">Entendi e quero continuar</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CheckoutPage;
