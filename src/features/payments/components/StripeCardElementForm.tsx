import React, { useMemo, useState } from 'react';
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
import type { Address } from '../../../../types';

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
  submitLabel?: string;
  onPaymentMethodCreated: (paymentMethodId: string) => Promise<StripePaymentStep | undefined>;
  onPaymentFinalized?: (step?: StripePaymentStep) => Promise<void> | void;
}

const elementOptions = {
  style: {
    base: {
      color: '#0f172a',
      fontSize: '16px',
      fontFamily: 'Inter, sans-serif',
      fontWeight: '600',
      lineHeight: '24px',
      '::placeholder': {
        color: '#94a3b8',
      },
    },
    invalid: {
      color: '#e11d48',
      iconColor: '#e11d48',
    },
  },
};

const fieldShellClassName =
  'min-h-[56px] rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 transition-all focus-within:border-indigo-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-100 dark:border-slate-700 dark:bg-[#0f1020] dark:focus-within:border-indigo-400 dark:focus-within:bg-[#111428] dark:focus-within:ring-indigo-500/10';

const StripeCardElementFormInner: React.FC<Omit<StripeCardElementFormProps, 'publishableKey'>> = ({
  billingName,
  billingEmail,
  billingAddress,
  submitLabel = 'Pagar com cartao',
  onPaymentMethodCreated,
  onPaymentFinalized,
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cardholderName, setCardholderName] = useState(billingName || '');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [fieldCompletion, setFieldCompletion] = useState({
    cardNumber: false,
    cardExpiry: false,
    cardCvc: false,
  });

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

    setFieldCompletion((prev) => ({
      ...prev,
      [field]: Boolean(event.complete),
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      setError('O formulario seguro ainda esta carregando. Tente novamente em alguns segundos.');
      return;
    }

    if (!cardholderName.trim()) {
      setError('Informe o nome do titular do cartao.');
      return;
    }

    const cardNumberElement = elements.getElement(CardNumberElement);
    if (!cardNumberElement) {
      setError('O campo de numero do cartao ainda nao foi carregado.');
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

      if (paymentMethodResult.error || !paymentMethodResult.paymentMethod?.id) {
        throw new Error(paymentMethodResult.error?.message || 'Nao foi possivel validar os dados do cartao.');
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
          throw new Error(confirmation.error.message || 'Nao foi possivel confirmar o pagamento do cartao.');
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
      setError(submitError?.message || 'Falha ao processar o pagamento com cartao.');
    } finally {
      setSubmitting(false);
    }
  };

  const isFormReady =
    Boolean(stripe && elements) &&
    fieldCompletion.cardNumber &&
    fieldCompletion.cardExpiry &&
    fieldCompletion.cardCvc &&
    !submitting;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
          Cartao
        </p>
        <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
          Informe numero, validade e codigo de seguranca do cartao.
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
          Nome do titular
        </label>
        <input
          type="text"
          value={cardholderName}
          onChange={(event) => setCardholderName(event.target.value)}
          placeholder="Como esta impresso no cartao"
          autoComplete="cc-name"
          className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-[#0f1020] dark:text-white dark:focus:border-indigo-400 dark:focus:bg-[#111428] dark:focus:ring-indigo-500/10"
        />
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Esse nome pode ser diferente do nome da conta.
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
          Numero do cartao
        </label>
        <div className={fieldShellClassName}>
          <CardNumberElement
            options={{
              ...elementOptions,
              placeholder: '1234 1234 1234 1234',
            }}
            onChange={(event) => setFieldState('cardNumber', event)}
          />
        </div>
        {fieldErrors.cardNumber && (
          <p className="text-[11px] font-semibold text-rose-500">{fieldErrors.cardNumber}</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            Validade
          </label>
          <div className={fieldShellClassName}>
            <CardExpiryElement
              options={{
                ...elementOptions,
                placeholder: 'MM / AA',
              }}
              onChange={(event) => setFieldState('cardExpiry', event)}
            />
          </div>
          {fieldErrors.cardExpiry && (
            <p className="text-[11px] font-semibold text-rose-500">{fieldErrors.cardExpiry}</p>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
            Codigo de seguranca
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
          {fieldErrors.cardCvc && (
            <p className="text-[11px] font-semibold text-rose-500">{fieldErrors.cardCvc}</p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-[#0f1020]">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-full bg-emerald-100 p-2 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
            <Lock size={14} />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-900 dark:text-white">Pagamento seguro</p>
            <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
              Os dados do cartao sao tokenizados pela Stripe e nao passam em texto puro pelo sistema.
            </p>
            {cardholderName || billingEmail ? (
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {cardholderName ? `Titular: ${cardholderName}` : null}
                {cardholderName && billingEmail ? ' · ' : null}
                {billingEmail ? `Email: ${billingEmail}` : null}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {error && <p className="text-[11px] font-bold text-rose-500">{error}</p>}

      <button
        type="submit"
        disabled={!isFormReady}
        className="flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-emerald-600 text-[10px] font-black uppercase tracking-[0.2em] text-white transition-all hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
        {submitting ? 'Processando pagamento...' : submitLabel}
      </button>
    </form>
  );
};

const StripeCardElementForm: React.FC<StripeCardElementFormProps> = ({
  publishableKey,
  ...props
}) => {
  const stripePromise = useMemo(() => loadStripe(publishableKey), [publishableKey]);

  if (!publishableKey) {
    return <p className="text-[11px] font-bold text-rose-500">Stripe Publishable Key nao configurada.</p>;
  }

  return (
    <Elements stripe={stripePromise}>
      <StripeCardElementFormInner {...props} />
    </Elements>
  );
};

export default StripeCardElementForm;
