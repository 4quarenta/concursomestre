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
import { Loader2, ShieldCheck } from 'lucide-react';

interface StripeSetupCardFormProps {
  publishableKey: string;
  clientSecret: string;
  billingName?: string;
  billingEmail?: string;
  submitLabel?: string;
  onSaved: (paymentMethodId: string) => Promise<void> | void;
}

const stripeElementOptions = {
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

const StripeSetupCardFormInner: React.FC<Omit<StripeSetupCardFormProps, 'publishableKey'>> = ({
  clientSecret,
  billingName,
  billingEmail,
  submitLabel = 'Salvar cartao',
  onSaved,
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [saving, setSaving] = useState(false);
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
    if (!stripe || !elements) return;

    if (!cardholderName.trim()) {
      setError('Informe o nome do titular do cartao.');
      return;
    }

    const cardNumberElement = elements.getElement(CardNumberElement);
    if (!cardNumberElement) {
      setError('O campo de numero do cartao ainda nao foi carregado.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const result = await stripe.confirmCardSetup(clientSecret, {
        payment_method: {
          card: cardNumberElement,
          billing_details: {
            name: cardholderName.trim(),
            email: billingEmail,
          },
        },
      });

      if (result.error || !result.setupIntent?.payment_method) {
        throw new Error(result.error?.message || 'Nao foi possivel salvar o cartao.');
      }

      const paymentMethodId = String(result.setupIntent.payment_method);
      await onSaved(paymentMethodId);
    } catch (saveError: any) {
      setError(saveError.message || 'Falha ao salvar o cartao na Stripe.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/70">
        <div className="mb-3 flex items-center gap-3">
          <ShieldCheck size={18} className="text-emerald-500" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
            Cofre Stripe
          </span>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
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
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
              Numero do cartao
            </label>
            <div className={fieldShellClassName}>
              <CardNumberElement
                options={{
                  ...stripeElementOptions,
                  placeholder: '1234 1234 1234 1234',
                }}
                onChange={(event) => setFieldState('cardNumber', event)}
              />
            </div>
            {fieldErrors.cardNumber && <p className="text-[11px] font-bold text-rose-500">{fieldErrors.cardNumber}</p>}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                Validade
              </label>
              <div className={fieldShellClassName}>
                <CardExpiryElement
                  options={{
                    ...stripeElementOptions,
                    placeholder: 'MM / AA',
                  }}
                  onChange={(event) => setFieldState('cardExpiry', event)}
                />
              </div>
              {fieldErrors.cardExpiry && <p className="text-[11px] font-bold text-rose-500">{fieldErrors.cardExpiry}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                Codigo de seguranca
              </label>
              <div className={fieldShellClassName}>
                <CardCvcElement
                  options={{
                    ...stripeElementOptions,
                    placeholder: '123',
                  }}
                  onChange={(event) => setFieldState('cardCvc', event)}
                />
              </div>
              {fieldErrors.cardCvc && <p className="text-[11px] font-bold text-rose-500">{fieldErrors.cardCvc}</p>}
            </div>
          </div>

          {(cardholderName || billingEmail) && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[11px] font-medium text-slate-500 dark:border-slate-800 dark:bg-[#0f1020] dark:text-slate-400">
              {cardholderName ? `Titular: ${cardholderName}` : null}
              {cardholderName && billingEmail ? ' Â· ' : null}
              {billingEmail ? `Email: ${billingEmail}` : null}
            </div>
          )}
        </div>
      </div>

      {error && <p className="text-[11px] font-bold text-rose-500">{error}</p>}

      <button
        type="submit"
        disabled={!stripe || saving || !fieldCompletion.cardNumber || !fieldCompletion.cardExpiry || !fieldCompletion.cardCvc}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:bg-emerald-700 disabled:opacity-60"
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : null}
        {saving ? 'Salvando cartao...' : submitLabel}
      </button>
    </form>
  );
};

export const StripeSetupCardForm: React.FC<StripeSetupCardFormProps> = ({
  publishableKey,
  ...props
}) => {
  const stripePromise = useMemo(() => loadStripe(publishableKey), [publishableKey]);

  if (!publishableKey) {
    return <p className="text-[11px] font-bold text-rose-500">Stripe Publishable Key nao configurada.</p>;
  }

  return (
    <Elements stripe={stripePromise}>
      <StripeSetupCardFormInner {...props} />
    </Elements>
  );
};

export default StripeSetupCardForm;
