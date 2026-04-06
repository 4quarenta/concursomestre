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
  Elements,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js';
import {
  loadStripe,
  type Stripe,
  type StripeCardCvcElement,
} from '@stripe/stripe-js';
import { CreditCard, Loader2, Lock } from 'lucide-react';

interface StripeSavedCardCvcFormProps {
  publishableKey: string;
  cardBrand?: string;
  last4?: string;
  submitLabel?: string;
  onConfirm: (args: {
    stripe: Stripe;
    cvcElement: StripeCardCvcElement;
  }) => Promise<void>;
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

const StripeSavedCardCvcFormInner: React.FC<Omit<StripeSavedCardCvcFormProps, 'publishableKey'>> = ({
  submitLabel = 'Pagar com cartão salvo',
  onConfirm,
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      setError('O formulário seguro da Stripe ainda esta carregando. Tente novamente em alguns segundos.');
      return;
    }

    const cvcElement = elements.getElement(CardCvcElement);
    if (!cvcElement) {
      setError('O campo de código de segurança ainda não foi carregado.');
      return;
    }

    if (!isComplete) {
      setError('Digite o código de segurança do cartão salvo para continuar.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await onConfirm({ stripe, cvcElement });
    } catch (submitError: any) {
      setError(submitError?.message || 'Não foi possível confirmar o cartão salvo.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
        Para sua segurança, confirme o código de segurança deste cartão salvo antes de concluir a compra.
      </p>

      <div className="space-y-2">
        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
          Código de segurança
        </label>
        <div className={fieldShellClassName}>
          <CardCvcElement
            options={{
              ...elementOptions,
              placeholder: '123',
            }}
            onChange={(event) => {
              setFieldError(event.error?.message || null);
              setIsComplete(Boolean(event.complete));
            }}
          />
        </div>
        {fieldError ? (
          <p className="text-[11px] font-semibold text-rose-500">{fieldError}</p>
        ) : (
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            O CVV não fica salvo na plataforma e sera usado apenas nesta confirmacao.
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-[#0f1020]">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-full bg-emerald-100 p-2 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
            <Lock size={14} />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-900 dark:text-white">Confirmacao segura</p>
            <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
              A Stripe recolhe o código de segurança novamente para confirmar que o titular esta presente nesta compra.
            </p>
          </div>
        </div>
      </div>

      {error && <p className="text-[11px] font-bold text-rose-500">{error}</p>}

      <button
        type="submit"
        disabled={!stripe || !isComplete || submitting}
        className="flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-emerald-600 text-[10px] font-black uppercase tracking-[0.2em] text-white transition-all hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
        {submitting ? 'Confirmando cartão salvo...' : submitLabel}
      </button>
    </form>
  );
};

const StripeSavedCardCvcForm: React.FC<StripeSavedCardCvcFormProps> = ({
  publishableKey,
  ...props
}) => {
  const stripePromise = useMemo(() => loadStripe(publishableKey), [publishableKey]);

  if (!publishableKey) {
    return <p className="text-[11px] font-bold text-rose-500">Stripe Publishable Key não configurada.</p>;
  }

  return (
    <Elements stripe={stripePromise}>
      <StripeSavedCardCvcFormInner {...props} />
    </Elements>
  );
};

export default StripeSavedCardCvcForm;
