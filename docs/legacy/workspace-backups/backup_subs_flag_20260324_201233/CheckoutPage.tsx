import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { planService } from '../features/plans/services/planService';
import { Plan } from '../../types';
import {
    CheckCircle2, ShieldCheck, ArrowRight, ArrowLeft, CreditCard,
    Lock, User, Mail, UserPlus, LogIn, ChevronRight, QrCode, FileText, Calendar, ToggleRight, ToggleLeft, AlertTriangle, XCircle
} from 'lucide-react';
import { apiClient, ENDPOINTS } from '../core/api';
import ReCAPTCHA from 'react-google-recaptcha';

type CheckoutStep = 'identification' | 'payment';
type AuthMode = 'login' | 'register';
type PaymentMethod = 'credit_card' | 'pix' | 'boleto';

declare global {
    interface Window {
        MercadoPago: any;
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

    // Auth Form State
    const [authLoading, setAuthLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: ''
    });

    const [captchaToken, setCaptchaToken] = useState<string | null>(null);
    const recaptchaRef = React.useRef<ReCAPTCHA>(null);

    const isDevMode = systemSettings?.appMode !== 'production';
    const MP_PUBLIC_KEY = systemSettings?.mercadoPagoKey || 'TEST-1e38d560-c2b8-4a5c-8b12-bad17bb8a9ba';

    // Payment Form State
    const [paymentData, setPaymentData] = useState({
        cardNumber: '4235 6477 2802 5682',
        cardHolder: 'APRO',
        cardExpiry: '11/30',
        cardCvv: '123',
        cpf: '12345678909',
        payerName: '',
        installments: '1'
    });

    // Mercado Pago State
    const [installmentOptions, setInstallmentOptions] = useState<any[]>([]);
    const [paymentMethodId, setPaymentMethodId] = useState<string>('master');

    // Saved Cards State
    const [savedCards, setSavedCards] = useState<any[]>([]);
    const [isUsingSavedCard, setIsUsingSavedCard] = useState(false);
    const [selectedCard, setSelectedCard] = useState<any>(null);

    useEffect(() => {
        if (!planId) {
            navigate('/plans');
            return;
        }
        loadPlan();
    }, [planId]);

    // Watch card number for BIN detection
    useEffect(() => {
        const bin = paymentData.cardNumber.replace(/\s/g, '').slice(0, 6);
        if (bin.length === 6 && plan) {
            updateInstallments(bin);
        }
    }, [paymentData.cardNumber, plan]);

    const updateInstallments = async (bin?: string, paymentMethodId?: string) => {
        try {
            // Using the existing endpoint from marketplace
            const response = await apiClient.get<any>('payments/get-installments.php', {
                params: { 
                    amount: plan?.price, 
                    bin,
                    payment_method_id: paymentMethodId
                }
            });

            // apiClient might return the data directly or wrapped
            const data = response.data?.data || response.data || response;

            if (data && data[0]) {
                setInstallmentOptions(data[0].payer_costs || []);
                setPaymentMethodId(data[0].payment_method_id || 'master');
                console.log('💳 Payment Method Detected:', data[0].payment_method_id);
            }
        } catch (err) {
            console.error('Failed to fetch installments:', err);
        }
    };

    const loadPlan = async () => {
        try {
            const plans = await planService.getPlans();
            const found = plans.find(p => p.id === Number(planId));
            if (found) {
                setPlan(found);

                // Set default installments based on plan cycle
                let defaultInstallments = '1';
                const unit = found.interval_unit?.toLowerCase();
                const name = found.name?.toLowerCase() || '';

                if (unit === 'year' || name.includes('anual') || name.includes('annual')) {
                    defaultInstallments = '12';
                } else if ((unit === 'month' && found.interval_count === 3) || name.includes('trimestral')) {
                    defaultInstallments = '3';
                }

                setPaymentData(prev => ({ ...prev, installments: defaultInstallments }));

                // Hierarchy Enforcement
                if (currentUser?.subscription?.status === 'active') {
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
                    const currentPlanTier = getTier(currentUser.subscription.plan?.name || '');
                    const currentTimeScore = currentPlanInList ? getTimeScore(currentPlanInList) : 1;

                    const targetPlanTier = getTier(found.name);
                    const targetPlanTimeScore = getTimeScore(found);

                    // Block ONLY if BOTH tier and duration are not superior
                    if (targetPlanTier <= currentPlanTier && targetPlanTimeScore <= currentTimeScore) {
                        addToast(`Você já possui o plano ${currentUser.subscription.plan?.name || 'Premium'}. Não é possível assinar um plano inferior ou igual enquanto o atual estiver ativo.`, 'warning');
                        navigate('/profile');
                        return;
                    }

                    // If it's a Tier Downgrade (but Duration is superior), show warning
                    if (targetPlanTier < currentPlanTier) {
                        setShowDowngradeModal(true);
                    }

                    // Pro-rata Calculation for Upgrade
                    const currentPlan = plans.find(p => p.id === currentUser.subscription?.plan_id);
                    if (currentPlan && currentPlan.price > 0 && currentUser.subscription.current_period_start && currentUser.subscription.current_period_end) {
                        const start = new Date(currentUser.subscription.current_period_start).getTime();
                        const end = new Date(currentUser.subscription.current_period_end).getTime();
                        const now = new Date().getTime();

                        if (end > now && end > start) {
                            const totalDuration = end - start;
                            const remaining = end - now;
                            const credit = (currentPlan.price * remaining) / totalDuration;
                            setProRatedCredit(Math.round(credit * 100) / 100);
                        }
                    }
                }
            } else {
                addToast('Plano não encontrado', 'error');
                navigate('/plans');
            }
        } catch (error) {
            addToast('Erro ao carregar detalhes do plano', 'error');
            navigate('/plans');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (currentUser) {
            setStep('payment');
            // Pre-fill payer name/email if available
            setPaymentData(prev => ({ ...prev, payerName: currentUser.name, cpf: currentUser.cpf || '' }));
            loadSavedCards();
        } else {
            setStep('identification');
        }
    }, [currentUser]);

    const loadSavedCards = async () => {
        if (!currentUser) return;
        try {
            const response: any = await apiClient.post('/users/list_cards.php', { user_id: currentUser.id });
            if (response.success && response.cards && response.cards.length > 0) {
                setSavedCards(response.cards);
                const defaultCard = response.cards.find((c: any) => c.is_default == 1) || response.cards[0];
                if (defaultCard) {
                    setSelectedCard(defaultCard);
                    setIsUsingSavedCard(true);

                    // Trigger installments update for saved card
                    updateInstallments(undefined, defaultCard.brand);
                }
            }
        } catch (err) {
            console.error('Failed to load saved cards:', err);
        }
    };

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
                // Login
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

    const handlePayment = async () => {
        console.log('handlePayment triggered', { plan, currentUser, selectedMethod });
        if (!plan || !currentUser) {
            console.error('Missing plan or user', { plan, currentUser });
            return;
        }

        // Basic Validation
        if (selectedMethod === 'credit_card') {
            if (!paymentData.cardNumber || !paymentData.cardHolder || !paymentData.cardExpiry || !paymentData.cardCvv || !paymentData.cpf) {
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

                // --- TOKENIZAÇÃO SEGURA (PCI COMPLIANCE) ---
                // O token agora é gerado no CLIENTE usando o SDK oficial, 
                // para que dados sensíveis (CVV/Número) nunca passem pelo nosso servidor.
                try {
                    const mp = new window.MercadoPago(MP_PUBLIC_KEY);
                    
                    if (isUsingSavedCard && selectedCard) {
                        // Tokenize using saved card ID
                        const cardTokenRes = await mp.createCardToken({
                            cardId: selectedCard.mp_card_id,
                            securityCode: paymentData.cardCvv, // Use paymentData.cardCvv for saved card CVV
                        });
                        
                        if (!cardTokenRes || !cardTokenRes.id) {
                            throw new Error('Erro ao validar cartão salvo. Verifique o CVV.');
                        }
                        
                        cardToken = cardTokenRes.id;
                        cardLastFour = selectedCard.last_four_digits;
                    } else {
                        // Tokenize using new card data
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
                            cardholderEmail:      currentUser?.email || paymentData.payerName || '', // Recomendado para assinaturas
                        });

                        if (!cardTokenRes || !cardTokenRes.id) {
                            throw new Error('Erro ao gerar token de segurança do cartão. Verifique os dados.');
                        }

                        cardToken    = cardTokenRes.id;
                        cardLastFour = paymentData.cardNumber.replace(/\s/g, '').slice(-4);
                    }
                } catch (tkErr: any) {
                    console.error('Tokenization error:', tkErr);
                    throw new Error(tkErr.message || 'Falha na comunicação segura com o Mercado Pago.');
                }


                // Enviar ao backend para processar o pagamento/assinatura
                const response = await planService.processPayment({
                    token: cardToken,
                    plan_id: plan.id,
                    amount: Number(plan.price),
                    user_id: currentUser.id,
                    payment_method_id: paymentMethodId,
                    installments: isRecurring ? 1 : parseInt(paymentData.installments, 10),
                    recurring_mode: isRecurring,
                    is_recurring: isRecurring,
                    auto_renew: autoRenew,
                    save_card: saveCard || isRecurring,
                    pro_rated_credit: proRatedCredit,
                    cardLastFour,
                    payer: {
                        email: currentUser.email,
                        identification: {
                            type: 'CPF',
                            number: paymentData.cpf.replace(/\D/g, '')
                        }
                    }
                });

                if (response.success && response.status === 'approved') {
                    addToast('Assinatura realizada com sucesso!', 'success');
                    // Refresh user context immediately so profile shows correct plan
                    await refreshUser();
                    navigate('/profile');
                } else {
                    addToast(response.error || 'Pagamento recusado ou erro no processamento.', 'error');
                }
            } else {
                // PIX / Boleto logic (currently redirect preference as fallback or similar)
                addToast('Processamento via PIX/Boleto em breve. Use cartão de crédito para teste.', 'info');
                setProcessing(false);
            }
        } catch (error: any) {
            console.error(error);
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

        if (unit === 'year' || name.includes('anual') || name.includes('annual')) return 12;
        if ((unit === 'month' && plan.interval_count === 3) || name.includes('trimestral')) return 3;
        return 1;
    }, [plan]);

    const selectedInstallment = useMemo(() => {
        if (!plan) return null;
        const installmentsNumber = Number(paymentData.installments) || 1;

        if (isRecurring) {
            // In recurring mode we charge only one cycle at a time (monthly/quarterly/annual broken into maxInstallments)
            return {
                installments: 1,
                installment_amount: plan.price / maxInstallments,
                total_amount: plan.price / maxInstallments,
            };
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

        // Fallback calculation with a conservative default rate
        const rate = 0.0299;
        const installment_amount = installmentsNumber === 1
            ? Number(plan.price)
            : (Number(plan.price) * rate) / (1 - Math.pow(1 + rate, -installmentsNumber));

        return {
            installments: installmentsNumber,
            installment_amount,
            total_amount: installment_amount * installmentsNumber,
        };
    }, [plan, installmentOptions, paymentData.installments, isRecurring, maxInstallments]);

    const monetaryTotals = useMemo(() => {
        if (!plan || !selectedInstallment) {
            return {
                subtotal: 0,
                firstCharge: 0,
                totalDue: 0,
            };
        }

        const subtotal = isRecurring
            ? selectedInstallment.total_amount
            : Number(plan.price);

        // Apply credit to the first charge; keep total floor at zero
        const firstCharge = Math.max(0, selectedInstallment.installment_amount - proRatedCredit);
        const totalDue = Math.max(0, (isRecurring ? selectedInstallment.total_amount : selectedInstallment.total_amount) - proRatedCredit);

        return {
            subtotal,
            firstCharge,
            totalDue,
        };
    }, [plan, selectedInstallment, isRecurring, proRatedCredit]);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-[#0f1020] flex items-center justify-center transition-colors">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 dark:border-indigo-500"></div>
            </div>
        );
    }

    if (!plan) return null;



    const handleBack = () => {
        if (location.state && location.state.from) {
            navigate(location.state.from + (location.state.search || ''));
        } else {
            navigate(-1);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-[#0f1020] py-12 px-4 relative overflow-hidden transition-colors">
            <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-indigo-50 to-transparent dark:from-indigo-900/20 dark:to-transparent pointer-events-none"></div>

            <div className="container mx-auto max-w-5xl relative z-10">
                <button
                    onClick={handleBack}
                    className="flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors mb-8 group font-medium text-sm"
                >
                    <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                    Voltar
                </button>

                {/* Steps Indicator */}
                <div className="flex items-center justify-center mb-10 gap-4">
                    <div className={`flex items-center gap-2 ${step === 'identification' ? 'text-white' : 'text-emerald-500'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${step === 'identification' ? 'bg-indigo-600' : 'bg-emerald-500 text-black'}`}>
                            {step === 'identification' ? '1' : <CheckCircle2 size={16} />}
                        </div>
                        <span className="font-bold text-sm uppercase tracking-wider">Identificação</span>
                    </div>
                    <div className="w-12 h-px bg-slate-700"></div>
                    <div className={`flex items-center gap-2 ${step === 'payment' ? 'text-white' : 'text-slate-600'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${step === 'payment' ? 'bg-indigo-600' : 'bg-slate-800'}`}>2</div>
                        <span className="font-bold text-sm uppercase tracking-wider">Pagamento</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

                    {/* Main Content Area */}
                    <div className="lg:col-span-2 space-y-6">

                        {/* Step 1: Identification */}
                        {step === 'identification' && (
                            <div className="bg-white dark:bg-[#1a1c2e] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 md:p-8 shadow-xl animate-fade-in transition-colors">
                                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                                    <User size={20} className="text-indigo-600 dark:text-indigo-500" />
                                    Identificação
                                </h2>

                                {/* Toggle Auth Mode */}
                                <div className="flex bg-slate-100 dark:bg-[#0f1020] p-1 rounded-xl mb-6 w-full md:w-fit transition-colors">
                                    <button
                                        onClick={() => setAuthMode('register')}
                                        className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${authMode === 'register' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                    >
                                        Criar Conta
                                    </button>
                                    <button
                                        onClick={() => setAuthMode('login')}
                                        className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${authMode === 'login' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                    >
                                        Já tenho conta
                                    </button>
                                </div>

                                <form onSubmit={handleAuth} className="space-y-4 max-w-md">
                                    {authMode === 'register' && (
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest ml-1">Nome Completo</label>
                                            <div className="relative">
                                                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
                                                <input
                                                    type="text"
                                                    required
                                                    value={formData.name}
                                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                                    className="w-full h-12 pl-11 pr-4 bg-slate-50 dark:bg-[#0f1020] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
                                                    placeholder="Seu nome"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest ml-1">E-mail</label>
                                        <div className="relative">
                                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
                                            <input
                                                type="email"
                                                required
                                                value={formData.email}
                                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                                                className="w-full h-12 pl-11 pr-4 bg-slate-50 dark:bg-[#0f1020] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
                                                placeholder="seu@email.com"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest ml-1">Senha</label>
                                        <div className="relative">
                                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
                                            <input
                                                type="password"
                                                required
                                                value={formData.password}
                                                onChange={e => setFormData({ ...formData, password: e.target.value })}
                                                className="w-full h-12 pl-11 pr-4 bg-slate-50 dark:bg-[#0f1020] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
                                                placeholder="••••••••"
                                            />
                                        </div>
                                    </div>

                                    {authMode === 'register' && (
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest ml-1">Confirmar Senha</label>
                                            <div className="relative">
                                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
                                                <input
                                                    type="password"
                                                    required
                                                    value={formData.confirmPassword}
                                                    onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
                                                    className="w-full h-12 pl-11 pr-4 bg-slate-50 dark:bg-[#0f1020] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
                                                    placeholder="••••••••"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Google reCAPTCHA — apenas no login e cadastro (desabilitado no DEV) */}
                                    {!isDevMode && (
                                        <div className="flex justify-center py-2">
                                            <ReCAPTCHA
                                                ref={recaptchaRef}
                                                sitekey={systemSettings.recaptchaSiteKey || "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI"}
                                                onChange={(token) => setCaptchaToken(token)}
                                                theme="light"
                                            />
                                        </div>
                                    )}

                                    <button
                                        type="submit"
                                        disabled={authLoading}
                                        className="w-full h-12 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl text-xs uppercase tracking-widest shadow-lg transition-all flex items-center justify-center gap-2 mt-4"
                                    >
                                        {authLoading ? 'Processando...' : (authMode === 'register' ? 'Criar Conta e Continuar' : 'Entrar e Continuar')}
                                        {!authLoading && <ArrowRight size={16} />}
                                    </button>
                                </form>
                            </div>
                        )}

                        {/* Step 2: Payment */}
                        {step === 'payment' && (
                            <div className="bg-white dark:bg-[#1a1c2e] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 md:p-8 shadow-xl animate-fade-in space-y-8 transition-colors">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                                        <CreditCard size={20} className="text-indigo-600 dark:text-indigo-500" />
                                        Forma de Pagamento
                                    </h2>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                        <button
                                            onClick={() => setSelectedMethod('credit_card')}
                                            className={`p-4 rounded-xl border flex flex-col items-center gap-3 transition-all ${selectedMethod === 'credit_card' ? 'bg-indigo-50 dark:bg-indigo-600/10 border-indigo-600 dark:border-indigo-500 text-indigo-700 dark:text-indigo-400' : 'bg-slate-50 dark:bg-[#0f1020] border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300 dark:hover:border-slate-500'}`}
                                        >
                                            <CreditCard size={24} />
                                            <span className="text-xs font-bold uppercase tracking-wider">Cartão de Crédito</span>
                                        </button>
                                        <button
                                            onClick={() => setSelectedMethod('pix')}
                                            className={`p-4 rounded-xl border flex flex-col items-center gap-3 transition-all ${selectedMethod === 'pix' ? 'bg-indigo-50 dark:bg-indigo-600/10 border-indigo-600 dark:border-indigo-500 text-indigo-700 dark:text-indigo-400' : 'bg-slate-50 dark:bg-[#0f1020] border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300 dark:hover:border-slate-500'}`}
                                        >
                                            <QrCode size={24} />
                                            <span className="text-xs font-bold uppercase tracking-wider">PIX</span>
                                        </button>
                                        <button
                                            onClick={() => setSelectedMethod('boleto')}
                                            className={`p-4 rounded-xl border flex flex-col items-center gap-3 transition-all ${selectedMethod === 'boleto' ? 'bg-indigo-50 dark:bg-indigo-600/10 border-indigo-600 dark:border-indigo-500 text-indigo-700 dark:text-indigo-400' : 'bg-slate-50 dark:bg-[#0f1020] border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300 dark:hover:border-slate-500'}`}
                                        >
                                            <FileText size={24} />
                                            <span className="text-xs font-bold uppercase tracking-wider">Boleto</span>
                                        </button>
                                    </div>

                                    {/* Payment Inputs */}
                                    <div className="bg-slate-50 dark:bg-[#0f1020] p-6 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4 transition-colors">
                                        {selectedMethod === 'credit_card' && (
                                            <>
                                                {isUsingSavedCard && savedCards.length > 0 ? (
                                                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                                        <div className="space-y-2">
                                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Selecione um Cartão Salvo</label>
                                                            <div className="grid grid-cols-1 gap-3">
                                                                {savedCards.map((card) => (
                                                                    <div 
                                                                        key={card.id}
                                                                        onClick={() => {
                                                                            setSelectedCard(card);
                                                                            updateInstallments(undefined, card.brand);
                                                                        }}
                                                                        className={`flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all border-2 ${selectedCard?.id === card.id ? 'bg-indigo-50 dark:bg-indigo-600/10 border-indigo-600 dark:border-indigo-500 shadow-sm' : 'bg-white dark:bg-[#1a1c2e] border-slate-200 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-900/50'}`}
                                                                    >
                                                                        <div className="flex items-center gap-4">
                                                                            <div className="w-12 h-8 bg-slate-100 dark:bg-slate-800 rounded flex items-center justify-center">
                                                                                <CreditCard size={16} className={selectedCard?.id === card.id ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500'} />
                                                                            </div>
                                                                            <div>
                                                                                <p className={`text-sm font-bold uppercase ${selectedCard?.id === card.id ? 'text-indigo-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                                                                                    {card.brand} •••• {card.last_four_digits}
                                                                                </p>
                                                                                {card.is_default == 1 && (
                                                                                    <p className="text-[9px] text-emerald-500 font-black uppercase tracking-widest">Padrão</p>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedCard?.id === card.id ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300 dark:border-slate-700'}`}>
                                                                            {selectedCard?.id === card.id && <div className="w-2 h-2 rounded-full bg-white" />}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                            <button 
                                                                onClick={() => setIsUsingSavedCard(false)}
                                                                className="w-full mt-2 py-3 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-[10px] font-black text-slate-500 uppercase tracking-widest hover:border-indigo-300 dark:hover:border-indigo-900 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all"
                                                            >
                                                                + Usar outro cartão
                                                            </button>
                                                        </div>

                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Confirmar CVV do cartão selecionado</label>
                                                            <div className="relative">
                                                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                                                <input
                                                                    type="password"
                                                                    maxLength={4}
                                                                    placeholder="123"
                                                                    value={paymentData.cardCvv}
                                                                    onChange={e => setPaymentData({ ...paymentData, cardCvv: e.target.value })}
                                                                    className="w-full h-12 pl-11 pr-4 bg-white dark:bg-[#1a1c2e] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-bold outline-none focus:border-indigo-500 transition-all placeholder:text-slate-400"
                                                                />
                                                            </div>
                                                            <p className="text-[9px] text-slate-400 mt-1 ml-1 uppercase font-bold italic">Sua segurança é nossa prioridade. Dados criptografados.</p>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        {savedCards.length > 0 && (
                                                            <div className="mb-4">
                                                                <button 
                                                                    onClick={() => {
                                                                        setIsUsingSavedCard(true);
                                                                        if (selectedCard) updateInstallments(undefined, selectedCard.brand);
                                                                    }}
                                                                    className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest hover:underline flex items-center gap-1.5"
                                                                >
                                                                    <ArrowLeft size={12} /> Voltar para cartão salvo
                                                                </button>
                                                            </div>
                                                        )}
                                                        {/* Número do Cartão */}
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Número do Cartão</label>
                                                            <input
                                                                type="text"
                                                                placeholder="0000 0000 0000 0000"
                                                                value={paymentData.cardNumber}
                                                                onChange={e => setPaymentData({ ...paymentData, cardNumber: e.target.value })}
                                                                className="w-full h-12 px-4 bg-white dark:bg-[#1a1c2e] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-bold outline-none focus:border-indigo-500 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
                                                            />
                                                        </div>

                                                        {/* Nome no Cartão */}
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nome no Cartão</label>
                                                            <input
                                                                type="text"
                                                                placeholder="NOME COMO NO CARTÃO"
                                                                value={paymentData.cardHolder}
                                                                onChange={e => setPaymentData({ ...paymentData, cardHolder: e.target.value })}
                                                                className="w-full h-12 px-4 bg-white dark:bg-[#1a1c2e] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-bold outline-none focus:border-indigo-500 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 uppercase"
                                                            />
                                                        </div>

                                                        {/* Validade e CVV */}
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div className="space-y-1">
                                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Validade</label>
                                                                <input
                                                                    type="text"
                                                                    placeholder="MM/AA"
                                                                    value={paymentData.cardExpiry}
                                                                    onChange={e => setPaymentData({ ...paymentData, cardExpiry: e.target.value })}
                                                                    className="w-full h-12 px-4 bg-white dark:bg-[#1a1c2e] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-bold outline-none focus:border-indigo-500 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
                                                                />
                                                            </div>
                                                            <div className="space-y-1">
                                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">CVV</label>
                                                                <input
                                                                    type="text"
                                                                    placeholder="123"
                                                                    value={paymentData.cardCvv}
                                                                    onChange={e => setPaymentData({ ...paymentData, cardCvv: e.target.value })}
                                                                    className="w-full h-12 px-4 bg-white dark:bg-[#1a1c2e] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-bold outline-none focus:border-indigo-500 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
                                                                />
                                                            </div>
                                                        </div>

                                                        {/* CPF */}
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">CPF do Titular</label>
                                                            <input
                                                                type="text"
                                                                placeholder="000.000.000-00"
                                                                value={paymentData.cpf}
                                                                onChange={e => setPaymentData({ ...paymentData, cpf: e.target.value })}
                                                                className="w-full h-12 px-4 bg-white dark:bg-[#1a1c2e] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-bold outline-none focus:border-indigo-500 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
                                                            />
                                                        </div>

                                                        {/* Save Card Option */}
                                                        <div className="pt-2">
                                                            <label className="flex items-center gap-3 p-4 bg-indigo-50 dark:bg-indigo-500/5 hover:bg-indigo-100 dark:hover:bg-indigo-500/10 border border-indigo-200 dark:border-slate-700 rounded-xl cursor-pointer transition-all group">
                                                                <div className="relative">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={saveCard || isRecurring}
                                                                        disabled={isRecurring}
                                                                        onChange={(e) => setSaveCard(e.target.checked)}
                                                                        className="sr-only peer"
                                                                    />
                                                                    <div className="w-10 h-6 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                                                </div>
                                                                <div className="flex flex-col">
                                                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 group-hover:text-indigo-700 dark:group-hover:text-white transition-colors">
                                                                        Salvar este cartão para compras futuras {isRecurring && <span className="text-indigo-600 dark:text-indigo-400 font-extrabold ml-1">(Obrigatório na Recorrência)</span>}
                                                                    </span>
                                                                    <span className="text-[10px] text-slate-500">Seus dados serão tokenizados e armazenados de forma segura.</span>
                                                                </div>
                                                            </label>
                                                        </div>
                                                    </>
                                                )}

                                                {/* Recurring Option & Installments (common for both saved and new cards) */}
                                                <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800/50 mt-4">
                                                    {/* Recurring Option (Beta) */}
                                                    {systemSettings?.features?.recurringEnabled && maxInstallments > 1 && (
                                                        <div className="pt-2">
                                                            <label className={`flex items-start gap-4 p-4 rounded-xl cursor-pointer transition-all group border-2 ${isRecurring ? 'bg-indigo-50 dark:bg-indigo-600/10 border-indigo-600 dark:border-indigo-500' : 'bg-white dark:bg-[#1a1c2e] border-slate-200 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-900/50'}`}>
                                                                <div className="relative mt-1">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={isRecurring}
                                                                        onChange={(e) => {
                                                                            const val = e.target.checked;
                                                                            setIsRecurring(val);
                                                                            if (val) {
                                                                                setSaveCard(true);
                                                                                setAutoRenew(true);
                                                                                setPaymentData(p => ({ ...p, installments: '1' }));
                                                                            }
                                                                        }}
                                                                        className="sr-only peer"
                                                                    />
                                                                    <div className="w-10 h-6 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                                                </div>
                                                                <div className="flex-1 space-y-1">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest">Cobranças Recorrentes (Não compromete limite)</span>
                                                                        <span className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-500 text-[8px] font-black uppercase rounded">Beta</span>
                                                                    </div>
                                                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                                                                        Ative para pagar apenas o valor mensal (R$ {(plan.price / maxInstallments).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) a cada mês. Ideal para não comprometer o limite total do cartão e evitar juros de parcelamento bancário.
                                                                    </p>
                                                                </div>
                                                            </label>
                                                        </div>
                                                    )}

                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">{isRecurring ? 'Parcelamento (Trava em 1x no modo recorrente)' : 'Parcelamento'}</label>
                                                        <select
                                                            disabled={isRecurring}
                                                            value={paymentData.installments}
                                                            onChange={e => setPaymentData({ ...paymentData, installments: e.target.value })}
                                                            className={`w-full h-12 px-4 bg-white dark:bg-[#1a1c2e] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-bold outline-none transition-all appearance-none ${isRecurring ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer focus:border-indigo-500'}`}
                                                        >
                                                            {isRecurring ? (
                                                                <option value="1">1x de R$ {(plan.price / maxInstallments).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} s/ juros (Recorrência)</option>
                                                            ) : (
                                                                installmentOptions.length > 0 ? (
                                                                    installmentOptions.map((opt: any) => (
                                                                        <option key={opt.installments} value={opt.installments} className="bg-white dark:bg-[#0f1020]">
                                                                            {opt.recommended_message}
                                                                        </option>
                                                                    ))
                                                                ) : (
                                                                    Array.from({ length: 12 }, (_, i) => i + 1).map(n => {
                                                                        const rate = 0.0299; // Estimativa de taxa padrão Mercado Pago
                                                                        const installmentAmount = n === 1 ? plan.price : (plan.price * rate) / (1 - Math.pow(1 + rate, -n));
                                                                        return (
                                                                            <option key={n} value={n} className="bg-white dark:bg-[#0f1020]">
                                                                                {n}x de R$ {installmentAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {n === 1 ? 'à vista' : '(com juros do cartão)'}
                                                                            </option>
                                                                        );
                                                                    })
                                                                )
                                                            )}
                                                        </select>
                                                    </div>
                                                </div>
                                            </>
                                        )}

                                        {(selectedMethod === 'pix' || selectedMethod === 'boleto') && (
                                            <>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nome Completo</label>
                                                    <input
                                                        type="text"
                                                        placeholder="Seu nome completo"
                                                        value={paymentData.payerName}
                                                        onChange={e => setPaymentData({ ...paymentData, payerName: e.target.value })}
                                                        className="w-full h-12 px-4 bg-white dark:bg-[#1a1c2e] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-bold outline-none focus:border-indigo-500 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">CPF</label>
                                                    <input
                                                        type="text"
                                                        placeholder="000.000.000-00"
                                                        value={paymentData.cpf}
                                                        onChange={e => setPaymentData({ ...paymentData, cpf: e.target.value })}
                                                        className="w-full h-12 px-4 bg-white dark:bg-[#1a1c2e] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-bold outline-none focus:border-indigo-500 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
                                                    />
                                                </div>
                                                <div className="p-4 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 rounded-lg text-xs text-indigo-700 dark:text-indigo-300">
                                                    {selectedMethod === 'pix'
                                                        ? 'Ao confirmar, um código QR Code será gerado para pagamento instantâneo.'
                                                        : 'Ao confirmar, o boleto será gerado e poderá levar até 3 dias úteis para compensação.'}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                                        <Calendar size={20} className="text-indigo-600 dark:text-indigo-500" />
                                        Detalhes da Assinatura
                                    </h2>

                                    <div className="flex flex-col md:flex-row gap-6 p-4 bg-slate-50 dark:bg-[#0f1020] rounded-xl border border-slate-200 dark:border-slate-800 transition-colors">
                                        <div className="flex-1 space-y-4">
                                            <div className="flex items-center gap-3">
                                                <h3 className="text-lg font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">{displayName}</h3>
                                                <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 text-[10px] font-bold uppercase rounded border border-indigo-200 dark:border-indigo-500/20">
                                                    {billingCycle}
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Validade até</p>
                                                    <p className="text-slate-900 dark:text-white font-bold text-sm">{nextRenewalDate}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Renovação</p>
                                                    <button
                                                        onClick={() => setAutoRenew(!autoRenew)}
                                                        className={`flex items-center gap-2 text-xs font-bold transition-colors ${autoRenew ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}
                                                    >
                                                        {autoRenew ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                                                        {autoRenew ? 'Automática (Recomendado)' : 'Manual'}
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="pt-4 border-t border-slate-200 dark:border-slate-800/50">
                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Recursos Inclusos</p>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                    {plan.features.map((feature, idx) => (
                                                        <div key={idx} className="flex items-center gap-2">
                                                            <div className={`w-1.5 h-1.5 rounded-full ${feature.included ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}></div>
                                                            <span className={`text-[11px] font-bold ${feature.included ? 'text-slate-600 dark:text-slate-300' : 'text-slate-400 dark:text-slate-600 line-through'}`}>
                                                                {feature.text}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="mt-6 flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-100 dark:border-emerald-500/10 rounded-xl">
                                                <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                                                    <ShieldCheck size={20} />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">Garantia de 7 Dias</p>
                                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Satisfação garantida ou seu dinheiro de volta. Sem burocracia.</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Sidebar / Order Summary */}
                    <div className="lg:col-span-1 bg-white dark:bg-[#1a1c2e] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 md:p-8 shadow-xl sticky top-8 transition-colors">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                            <Lock size={20} className="text-emerald-500" />
                            Resumo Final
                        </h2>

                        <div className="space-y-4 mb-8">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500 dark:text-slate-400">Usuário</span>
                                <span className="text-slate-900 dark:text-white font-medium truncate max-w-[150px]">{currentUser ? currentUser.name : 'Visitante'}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500 dark:text-slate-400">Plano</span>
                                <span className="text-slate-900 dark:text-white font-medium">{displayName} {billingCycle}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500 dark:text-slate-400">Validade</span>
                                <span className="text-slate-900 dark:text-white font-medium">{nextRenewalDate}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500 dark:text-slate-400">Renovação</span>
                                <span className="text-slate-900 dark:text-white font-medium">{autoRenew ? 'Automática' : 'Manual'}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500 dark:text-slate-400">{isRecurring ? 'Próxima cobrança' : 'Subtotal'}</span>
                                <span className="text-slate-900 dark:text-white font-medium">
                                    R$ {monetaryTotals.firstCharge.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}{isRecurring ? '/mês' : ''}
                                </span>
                            </div>
                            {!isRecurring && selectedInstallment && selectedInstallment.installments > 1 && (
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-500 dark:text-slate-400">Parcela selecionada</span>
                                    <span className="text-slate-900 dark:text-white font-medium">
                                        {selectedInstallment.installments}x de R$ {selectedInstallment.installment_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                            )}
                            {proRatedCredit > 0 && (
                                <div className="flex justify-between items-center text-sm text-emerald-600 dark:text-emerald-400">
                                    <span className="font-medium">Crédito de Migração</span>
                                    <span className="font-bold">- R$ {proRatedCredit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                </div>
                            )}
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500 dark:text-slate-400">Total a Pagar</span>
                                <span className="text-emerald-600 dark:text-emerald-400 font-black text-lg">
                                    R$ {monetaryTotals.totalDue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                            <div className="h-px bg-slate-200 dark:bg-slate-700/50 my-2"></div>

                            <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-500/5 rounded-lg border border-emerald-100 dark:border-emerald-500/10 mt-2">
                                <ShieldCheck size={14} className="text-emerald-600 dark:text-emerald-400" />
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-black text-emerald-700 dark:text-emerald-400 uppercase">Garantia Total</span>
                                    <span className="text-[8px] text-slate-500 font-bold uppercase">7 dias de satisfação ou reembolso</span>
                                </div>
                            </div>

                            {step === 'payment' && (
                                <p className="text-xs text-slate-500 leading-relaxed">
                                    Pagamento via
                                    <strong className="text-slate-900 dark:text-white mx-1">
                                        {selectedMethod === 'credit_card' ? 'Cartão' : selectedMethod === 'pix' ? 'PIX' : 'Boleto'}
                                    </strong>
                                    processado por MercadoPago.
                                </p>
                            )}
                        </div>

                        {step === 'payment' ? (
                            <button
                                onClick={handlePayment}
                                disabled={processing}
                                className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] rounded-xl text-white font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {processing ? (
                                    <span className="animate-pulse">Processando...</span>
                                ) : (
                                    <>Confirmar e Pagar <ArrowRight size={18} /></>
                                )}
                            </button>
                        ) : (
                            <div className="p-4 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-xl text-center">
                                <p className="text-xs text-indigo-600 dark:text-indigo-400 font-bold">Faça login ou crie sua conta para prosseguir com o pagamento.</p>
                            </div>
                        )}

                        <div className="mt-6 flex flex-col items-center gap-2">
                            <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium uppercase tracking-wider">
                                <ShieldCheck size={14} className="text-slate-500" /> Ambiente 100% Seguro
                            </div>
                            <img src="https://logopng.com.br/logos/mercadopago-22.svg" alt="MercadoPago" className="h-6 opacity-50 grayscale hover:grayscale-0 transition-all" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Downgrade Warning Modal */}
            {showDowngradeModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-sm animate-in fade-in transition-all">
                    <div className="bg-slate-900 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-slate-800 animate-in zoom-in slide-in-from-bottom-4 duration-300">
                        <div className="p-8 text-center space-y-6">
                            <div className="w-20 h-20 bg-amber-500/10 rounded-2xl flex items-center justify-center mx-auto mb-2">
                                <AlertTriangle size={40} className="text-amber-500" />
                            </div>

                            <div className="space-y-4">
                                <h3 className="text-xl font-black text-white uppercase tracking-tight">Aviso de Downgrade</h3>
                                <p className="text-sm text-slate-400 leading-relaxed">
                                    Ao mudar para o plano <span className="text-white font-bold">{plan?.name}</span>, você manterá sua assinatura por um período maior, mas perderá acesso aos benefícios exclusivos do seu plano atual (<span className="text-indigo-400 font-bold">{currentUser?.subscription?.plan?.name}</span>) assim que a migração for concluída.
                                </p>
                                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 text-left">
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">O que muda:</p>
                                    <ul className="text-xs text-slate-300 space-y-2">
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
                                    onClick={() => setShowDowngradeModal(false)}
                                    className="w-full py-4 bg-white text-slate-900 rounded-xl font-black uppercase tracking-widest hover:bg-slate-200 transition-all shadow-lg active:scale-95"
                                >
                                    Entendi e quero continuar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CheckoutPage;
