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
import {
  CardCvcElement,
  CardExpiryElement,
  CardNumberElement,
  Elements,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { CreditCard, Loader2, Lock } from 'lucide-react';
import type { Address } from '@types';

type StripePaymentStep = {
  clientSecret?: string | null;
  status?: string | null;
  confirmationType?: 'payment' | 'setup' | 'none';
  subscriptionId?: string | null;
  paymentMethodId?: string | null;
  paymentIntentId?: string | null;
  saveCard?: boolean;
};

interface StripeCardElementFormProps {
  publishableKey: string;
  billingName?: string;
  billingEmail?: string;
  billingAddress?: Address;
  formId?: string;
  submitLabel?: string;
  legalNotice?: React.ReactNode;
  hideHeader?: boolean;
  hideTrustNote?: boolean;
  hideNameHelper?: boolean;
  hideSubmitButton?: boolean;
  onReadyChange?: (ready: boolean) => void;
  onPaymentMethodCreated: (paymentMethodId: string) => Promise<StripePaymentStep | undefined>;
  onPaymentFinalized?: (step?: StripePaymentStep) => Promise<void> | void;
}

const elementOptions = {
  style: {
    base: {
      color: '#18181b',
      fontSize: '14px',
      fontFamily: 'Inter, sans-serif',
      fontWeight: '500',
      lineHeight: '20px',
      '::placeholder': {
        color: '#a1a1aa',
      },
    },
    invalid: {
      color: '#dc2626',
      iconColor: '#dc2626',
    },
  },
};

const fieldShellClassName =
  'min-h-[50px] rounded-lg border border-zinc-200 bg-white px-4 py-3 transition-all focus-within:border-zinc-900 focus-within:ring-1 focus-within:ring-zinc-900 dark:border-slate-700 dark:bg-[#0f1020] dark:focus-within:border-indigo-400 dark:focus-within:bg-[#111428] dark:focus-within:ring-indigo-500/10';

const getCardBrandLabel = (brand?: string | null): string | null => {
  if (!brand || brand === 'unknown') return null;

  const labels: Record<string, string> = {
    visa: 'Visa',
    mastercard: 'Mastercard',
    amex: 'Amex',
    elo: 'Elo',
    hipercard: 'Hipercard',
    diners: 'Diners',
    discover: 'Discover',
    jcb: 'JCB',
    unionpay: 'UnionPay',
  };

  return labels[String(brand).toLowerCase()] || String(brand).toUpperCase();
};

/**
 * Formulário de novo cartão da Stripe usado pelo checkout oficial.
 * A integração permanece a mesma; esta versão apenas reduz ruído visual e segue o layout do checkout.
 * @since v1.0.0
 */
const StripeCardElementFormInner: React.FC<Omit<StripeCardElementFormProps, 'publishableKey'>> = ({
  billingName,
  billingEmail,
  billingAddress,
  formId,
  submitLabel = 'Confirmar assinatura',
  legalNotice,
  hideHeader = false,
  hideTrustNote = false,
  hideNameHelper = false,
  hideSubmitButton = false,
  onReadyChange,
  onPaymentMethodCreated,
  onPaymentFinalized,
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cardholderName, setCardholderName] = useState(billingName || '');
  const [cardBrand, setCardBrand] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [fieldCompletion, setFieldCompletion] = useState({
    cardNumber: false,
    cardExpiry: false,
    cardCvc: false,
  });
  const stripeReady = Boolean(stripe && elements);

  useEffect(() => {
    onReadyChange?.(stripeReady);

    return () => {
      onReadyChange?.(false);
    };
  }, [onReadyChange, stripeReady]);

  const setFieldState = (field: 'cardNumber' | 'cardExpiry' | 'cardCvc', event: any) => {
    setFieldErrors((prev) => {
      const next = { ...prev };
      if (event.error?.message) {
        next[field] = event.error.message;
      } else {
        delete next[field];
      }
      return next;
    });

    if (field === 'cardNumber') {
      setCardBrand(event.brand || null);
    }

    setFieldCompletion((prev) => ({
      ...prev,
      [field]: Boolean(event.complete),
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      setError('O formulário seguro ainda está carregando. Tente novamente em alguns segundos.');
      return;
    }

    if (!cardholderName.trim()) {
      setError('Informe o nome do titular do cartão.');
      return;
    }

    if (!fieldCompletion.cardNumber || !fieldCompletion.cardExpiry || !fieldCompletion.cardCvc) {
      setError('Preencha número, validade e código de segurança do cartão antes de continuar.');
      return;
    }

    const cardNumberElement = elements.getElement(CardNumberElement);
    if (!cardNumberElement) {
      setError('O campo de número do cartão ainda não foi carregado.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const paymentMethodResult = await stripe.createPaymentMethod({
        type: 'card',
        card: cardNumberElement,
        billing_details: {
          name: cardholderName.trim(),
          email: billingEmail,
          address: billingAddress ? {
            line1: [billingAddress.street, billingAddress.number].filter(Boolean).join(', '),
            line2: billingAddress.complement || undefined,
            city: billingAddress.city || undefined,
            state: billingAddress.state || undefined,
            postal_code: billingAddress.zipCode?.replace(/\D/g, '') || undefined,
            country: 'BR',
          } : undefined,
        },
      });

      if (!paymentMethodResult.paymentMethod?.id || paymentMethodResult.error) {
        throw new Error(paymentMethodResult.error?.message || 'Não foi possível validar os dados do cartão.');
      }

      const nextStep = await onPaymentMethodCreated(paymentMethodResult.paymentMethod.id);
      if (!nextStep) {
        return;
      }

      let confirmation: any = null;
      if (nextStep.clientSecret) {
        confirmation =
          nextStep.confirmationType === 'setup'
            ? await stripe.confirmCardSetup(nextStep.clientSecret, {
              payment_method: paymentMethodResult.paymentMethod.id,
            })
            : await stripe.confirmCardPayment(nextStep.clientSecret, {
              payment_method: paymentMethodResult.paymentMethod.id,
            });

        if (confirmation.error) {
          throw new Error(confirmation.error.message || 'Não foi possível confirmar o pagamento do cartão.');
        }
      }

      await onPaymentFinalized?.({
        ...nextStep,
        paymentMethodId: nextStep.paymentMethodId || paymentMethodResult.paymentMethod.id,
        paymentIntentId:
          nextStep.paymentIntentId ||
          (nextStep.confirmationType === 'payment'
            ? ((confirmation as any)?.paymentIntent?.id || null)
            : null),
      });
    } catch (submitError: any) {
      setError(submitError?.message || 'Falha ao processar o pagamento com cartão.');
    } finally {
      setSubmitting(false);
    }
  };

  const isFormReady =
    stripeReady &&
    fieldCompletion.cardNumber &&
    fieldCompletion.cardExpiry &&
    fieldCompletion.cardCvc &&
    !submitting;

  return (
    <form id={formId} onSubmit={handleSubmit} className="space-y-5">
      {!stripeReady ? (
        <div className="flex min-h-[180px] flex-col items-center justify-center rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/70 px-6 py-8 text-center text-indigo-700 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-200">
          <Loader2 size={26} className="animate-spin" />
          <p className="mt-4 text-sm font-black uppercase tracking-[0.16em]">
            Carregando checkout seguro
          </p>
          <p className="mt-2 max-w-sm text-xs font-semibold leading-relaxed text-indigo-500 dark:text-indigo-200/80">
            Aguarde enquanto a Stripe prepara os campos protegidos do cartão.
          </p>
          {error ? <p className="mt-3 text-[11px] font-medium text-rose-500">{error}</p> : null}
        </div>
      ) : (
        <>
          {!hideHeader ? (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Cartão
              </p>
              <p className="text-sm text-zinc-500">
                Informe número, validade e código de segurança.
              </p>
            </div>
          ) : null}

          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-700">
              Nome no cartão
            </label>
            <input
              type="text"
              value={cardholderName}
              onChange={(event) => setCardholderName(event.target.value)}
              placeholder="Nome como está no cartão"
              autoComplete="cc-name"
              className="h-[50px] w-full rounded-lg border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none transition-all placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 dark:border-slate-700 dark:bg-[#0f1020] dark:text-white dark:focus:border-indigo-400 dark:focus:bg-[#111428] dark:focus:ring-indigo-500/10"
            />
            {!hideNameHelper ? (
              <p className="text-[11px] text-zinc-500">
                Esse nome pode ser diferente do nome da conta.
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-700">
              Número do cartão
            </label>
            <div className="relative">
              <div className={`${fieldShellClassName} pr-24`}>
                <CardNumberElement
                  options={{
                    ...elementOptions,
                    placeholder: '1234 1234 1234 1234',
                  }}
                  onChange={(event) => setFieldState('cardNumber', event)}
                />
              </div>
              {getCardBrandLabel(cardBrand) ? (
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-zinc-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-600">
                  {getCardBrandLabel(cardBrand)}
                </div>
              ) : null}
            </div>
            {fieldErrors.cardNumber ? (
              <p className="text-[11px] font-medium text-rose-500">{fieldErrors.cardNumber}</p>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-700">
                Validade
              </label>
              <div className={fieldShellClassName}>
                <CardExpiryElement
                  options={{
                    ...elementOptions,
                    placeholder: 'MM/AA',
                  }}
                  onChange={(event) => setFieldState('cardExpiry', event)}
                />
              </div>
              {fieldErrors.cardExpiry ? (
                <p className="text-[11px] font-medium text-rose-500">{fieldErrors.cardExpiry}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-700">
                CVV
              </label>
              <div className={fieldShellClassName}>
                <CardCvcElement
                  options={{
                    ...elementOptions,
                    placeholder: '123',
                  }}
                  onChange={(event) => setFieldState('cardCvc', event)}
                />
              </div>
              {fieldErrors.cardCvc ? (
                <p className="text-[11px] font-medium text-rose-500">{fieldErrors.cardCvc}</p>
              ) : null}
            </div>
          </div>

          {!hideTrustNote ? (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-full bg-emerald-100 p-2 text-emerald-600">
                  <Lock size={14} />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-zinc-900">Pagamento seguro</p>
                  <p className="text-[11px] leading-relaxed text-zinc-500">
                    Os dados do cartão são tokenizados pela Stripe e não passam em texto puro pelo sistema.
                  </p>
                  {cardholderName || billingEmail ? (
                    <p className="text-[11px] font-medium text-zinc-500">
                      {cardholderName ? `Titular: ${cardholderName}` : null}
                      {cardholderName && billingEmail ? ' - ' : null}
                      {billingEmail ? `Email: ${billingEmail}` : null}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {error ? <p className="text-[11px] font-medium text-rose-500">{error}</p> : null}

          {legalNotice}

          {!hideSubmitButton ? (
            <button
              type="submit"
              disabled={!isFormReady}
              className="flex h-[54px] w-full items-center justify-center gap-3 rounded-lg bg-emerald-600 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-emerald-500/25 transition-all hover:-translate-y-0.5 hover:bg-emerald-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
              {submitting ? 'Processando assinatura...' : submitLabel}
            </button>
          ) : null}
        </>
      )}
    </form>
  );
};

const StripeCardElementForm: React.FC<StripeCardElementFormProps> = ({
  publishableKey,
  onReadyChange,
  ...props
}) => {
  const stripePromise = useMemo(() => loadStripe(publishableKey), [publishableKey]);

  useEffect(() => {
    if (!publishableKey) {
      onReadyChange?.(false);
    }
  }, [onReadyChange, publishableKey]);

  if (!publishableKey) {
    return <p className="text-[11px] font-medium text-rose-500">Stripe Publishable Key não configurada.</p>;
  }

  return (
    <Elements stripe={stripePromise}>
      <StripeCardElementFormInner onReadyChange={onReadyChange} {...props} />
    </Elements>
  );
};

export default StripeCardElementForm;
