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

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ShoppingBag, CreditCard, QrCode, X, ChevronRight, FileText, Check, Smartphone, Barcode, Loader } from 'lucide-react';
import { initMercadoPago } from '@mercadopago/sdk-react';
import type { Material } from '@types';
import { paymentsService } from '@services/payments';

// Initialize Mercado Pago (Using provided TEST key)
initMercadoPago('TEST-1e38d560-c2b8-4a5c-8b12-bad17bb8a9ba', {
    locale: 'pt-BR'
});

interface PaymentModalProps {
    material: Material;
    currentUser: any;
    onClose: () => void;
    onSuccess: () => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
    material,
    currentUser,
    onClose,
    onSuccess
}) => {
    // Layout State
    const [selectedMethod, setSelectedMethod] = useState<'card' | 'pix' | 'boleto'>('card');
    const [mounted, setMounted] = useState(false);
    const [coupon, setCoupon] = useState('');

    // Form State
    const [cardData, setCardData] = useState({
        number: '5031 4332 1540 6351', // Mastercard (Test)
        name: 'APRO TEST USER',
        expiry: '11/30',
        cvv: '123',
        installments: '1'
    });

    const [installmentOptions, setInstallmentOptions] = useState<any[]>([]);
    const [paymentMethodId, setPaymentMethodId] = useState<string>('master');

    // Mercado Pago State
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Initial load
    useEffect(() => {
        setMounted(true);
    }, []);

    // Watch card number for BIN detection
    useEffect(() => {
        const bin = cardData.number.replace(/\s/g, '').slice(0, 6);
        if (bin.length === 6) {
            void updateInstallments(bin);
        }
    }, [cardData.number]);

    const updateInstallments = async (bin: string) => {
        try {
            const response = await paymentsService.getInstallments({
                amount: material.price,
                bin,
            });
            if (response[0]) {
                setInstallmentOptions(response[0].payer_costs || []);
                setPaymentMethodId(response[0].payment_method_id || 'master');
            }
        } catch (err) {
            console.error('Failed to fetch installments:', err);
        }
    };

    const handlePayment = async () => {
        setIsLoading(true);
        setError(null);

        try {
            // 1. Get the MP instance (Ensure it exists)
            // @ts-ignore
            if (typeof window.MercadoPago === 'undefined') {
                throw new Error('O sistema de pagamento ainda está carregando. Por favor, aguarde um instante e tente novamente.');
            }

            // @ts-ignore
            const mp = new window.MercadoPago('TEST-1e38d560-c2b8-4a5c-8b12-bad17bb8a9ba', {
                locale: 'pt-BR'
            });

            // 2. Map expiry MM/AA to month and year
            const [expiryMonth, expiryYear] = cardData.expiry.split('/');

            // 3. Create Card Token
            const tokenResponse = await mp.createCardToken({
                cardNumber: cardData.number.replace(/\s/g, ''),
                cardholderName: cardData.name,
                cardExpirationMonth: expiryMonth,
                cardExpirationYear: expiryYear ? '20' + expiryYear : '', // Assuming YY to YYYY
                securityCode: cardData.cvv,
            });

            if (!tokenResponse || !tokenResponse.id) {
                throw new Error('Falha ao gerar token do cartão. Verifique os dados.');
            }

            // 4. Send to backend
            const response = await paymentsService.processMaterialPayment({
                token: tokenResponse.id,
                transaction_amount: material.price,
                description: material.title,
                installments: parseInt(cardData.installments),
                payment_method_id: paymentMethodId,
                material_id: material.id,
                seller_id: material.authorId,
                payer: {
                    email: currentUser?.email || 'test@test.com',
                    identification: {
                        type: 'CPF',
                        number: currentUser?.cpf?.replace(/\D/g, '') || '19119119100' // Valid Test CPF
                    }
                }
            });

            if (response.status === 'approved') {
                onSuccess();
            } else {
                setError(response.message || 'Pagamento recusado ou erro no processamento.');
            }
        } catch (err: any) {
            console.error('Payment error:', err);
            setError(err.message || 'Erro de conexão com o servidor.');
        } finally {
            setIsLoading(false);
        }
    };

    const handlePaymentStatus = (payment: any) => {
        if (payment.status === 'approved') {
            onSuccess();
        }
        // Handle other statuses if needed
    };



    const renderMethodButton = (id: 'card' | 'pix' | 'boleto', icon: React.ReactNode, label: string) => {
        const isActive = selectedMethod === id;
        return (
            <button
                onClick={() => setSelectedMethod(id)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${isActive
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
            >
                {icon}
                {label}
            </button>
        );
    };

    if (!mounted) return null;

    return createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 lg:p-8">
            <div className="absolute inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm animate-fade-in" onClick={onClose} />

            <div className="relative w-full max-w-5xl bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-scale-in flex flex-col lg:flex-row max-h-[90vh]">

                {/* Left: Content & Form */}
                <div className="flex-1 overflow-y-auto no-scrollbar p-8 lg:p-12 space-y-10">
                    <div className="flex justify-between items-start">
                        <div>
                            <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.2em]">Finalizar Pedido</span>
                            <h2 className="text-3xl font-black text-slate-900 dark:text-slate-100 mt-1">Checkout Seguro</h2>
                        </div>
                        <button onClick={onClose} className="lg:hidden p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                            <X className="text-slate-400" />
                        </button>
                    </div>

                    {/* Payment Method Selector */}
                    <div className="space-y-4">
                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Selecione o método</label>
                        <div className="flex gap-3">
                            {renderMethodButton('card', <CreditCard size={14} />, 'Cartão')}
                            {renderMethodButton('pix', <QrCode size={14} />, 'Pix')}
                            {renderMethodButton('boleto', <Barcode size={14} />, 'Boleto')}
                        </div>
                    </div>

                    {/* Dynamic Form Area */}
                    <div className="animate-slide-up">
                        {selectedMethod === 'card' && (
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Número do Cartão</label>
                                        <div className="relative">
                                            <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                            <input
                                                type="text"
                                                value={cardData.number}
                                                onChange={(e) => setCardData({ ...cardData, number: e.target.value })}
                                                placeholder="0000 0000 0000 0000"
                                                className="w-full h-12 pl-12 pr-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome no Cartão</label>
                                        <input
                                            type="text"
                                            value={cardData.name}
                                            onChange={(e) => setCardData({ ...cardData, name: e.target.value })}
                                            placeholder="Como impresso"
                                            className="w-full h-12 px-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Validade</label>
                                        <input
                                            type="text"
                                            value={cardData.expiry}
                                            onChange={(e) => setCardData({ ...cardData, expiry: e.target.value })}
                                            placeholder="MM/AA"
                                            className="w-full h-12 px-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">CVV</label>
                                        <input
                                            type="text"
                                            value={cardData.cvv}
                                            onChange={(e) => setCardData({ ...cardData, cvv: e.target.value })}
                                            placeholder="123"
                                            className="w-full h-12 px-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Parcelamento</label>
                                    <select
                                        value={cardData.installments}
                                        onChange={(e) => setCardData({ ...cardData, installments: e.target.value })}
                                        className="w-full h-12 px-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 outline-none appearance-none transition-all"
                                    >
                                        {installmentOptions.length > 0 ? (
                                            installmentOptions.map((opt) => (
                                                <option key={opt.installments} value={opt.installments}>
                                                    {opt.recommended_message}
                                                </option>
                                            ))
                                        ) : (
                                            <option value="1">1x de R$ {material.price.toFixed(2)} (Sem juros)</option>
                                        )}
                                    </select>
                                </div>
                            </div>
                        )}

                        {selectedMethod === 'pix' && (
                            <div className="flex flex-col items-center py-8 space-y-6 text-center">
                                <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 rounded-3xl flex items-center justify-center">
                                    <QrCode size={40} />
                                </div>
                                <div>
                                    <h4 className="font-black text-slate-900 dark:text-slate-100">Pagamento via Pix</h4>
                                    <p className="text-sm text-slate-500 max-w-xs mt-2">O acesso será liberado instantaneamente após a confirmação do pagamento.</p>
                                </div>
                            </div>
                        )}

                        {selectedMethod === 'boleto' && (
                            <div className="flex flex-col items-center py-8 space-y-6 text-center">
                                <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-3xl flex items-center justify-center">
                                    <Barcode size={40} />
                                </div>
                                <div>
                                    <h4 className="font-black text-slate-900 dark:text-slate-100">Pagamento via Boleto</h4>
                                    <p className="text-sm text-slate-500 max-w-xs mt-2">O acesso será liberado em até 3 dias úteis após o pagamento.</p>
                                </div>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={() => handlePayment()}
                        className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-xs tracking-widest rounded-2xl shadow-xl shadow-indigo-500/20 transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
                    >
                        {isLoading ? <Loader className="animate-spin" size={18} /> : (
                            <>
                                <span>Confirmar Pagamento</span>
                                <ChevronRight size={18} />
                            </>
                        )}
                    </button>

                    <div className="flex items-center justify-center gap-6 pt-4 grayscale opacity-40">
                        <Check size={16} />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ambiente 100% Seguro</span>
                    </div>
                </div>

                {/* Right: Summary Area */}
                <div className="lg:w-[400px] bg-slate-50 dark:bg-slate-900/50 p-8 lg:p-12 border-l border-slate-200 dark:border-slate-800 flex flex-col">
                    <div className="flex-1 space-y-10">
                        <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Resumo da Compra</span>
                            <div className="flex gap-4 mt-6">
                                <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 flex items-center justify-center shadow-sm text-indigo-600">
                                    <FileText size={28} />
                                </div>
                                <div className="flex flex-col justify-center">
                                    <h4 className="font-black text-slate-900 dark:text-slate-100 leading-tight">{material.title}</h4>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase mt-1 tracking-widest">{material.type}</p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4 pt-10 border-t border-slate-200 dark:border-slate-800">
                            <div className="flex justify-between items-center text-sm">
                                <span className="font-bold text-slate-500">Valor Original</span>
                                <span className="font-bold text-slate-900 dark:text-slate-100">R$ {(material.price * 1.2).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="font-bold text-slate-500">Desconto</span>
                                <span className="font-bold text-emerald-500">- R$ {(material.price * 0.2).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center pt-4 border-t border-slate-200 dark:border-slate-800">
                                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Total</span>
                                <span className="text-3xl font-black text-indigo-600 dark:text-indigo-400 tracking-tighter">R$ {material.price.toFixed(2)}</span>
                            </div>
                        </div>

                        <div className="space-y-4 pt-10 border-t border-slate-200 dark:border-slate-800">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cupom de Desconto</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={coupon}
                                    onChange={(e) => setCoupon(e.target.value)}
                                    placeholder="POSSUI CUPOM?"
                                    className="flex-1 h-11 px-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl text-xs font-black uppercase tracking-widest focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all placeholder:text-slate-300"
                                />
                                <button className="px-4 h-11 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all">OK</button>
                            </div>
                        </div>
                    </div>

                    <div className="mt-auto pt-8">
                        <button onClick={onClose} className="hidden lg:flex w-full items-center justify-center gap-2 text-[10px] font-black text-slate-400 hover:text-red-500 uppercase tracking-widest transition-colors">
                            <X size={14} /> Cancelar Compra
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};
