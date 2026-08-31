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
  formId?: string;
  submitLabel?: string;
  label?: string;
  legalNotice?: React.ReactNode;
  hideDescription?: boolean;
  hideLabel?: boolean;
  hideTrustNote?: boolean;
  hideFieldHint?: boolean;
  hideSubmitButton?: boolean;
  onReadyChange?: (ready: boolean) => void;
  onConfirm: (args: {
    stripe: Stripe;
    cvcElement: StripeCardCvcElement;
  }) => Promise<void>;
}

const buildElementOptions = (isDarkMode: boolean) => ({
  style: {
    base: {
      color: isDarkMode ? '#e2e8f0' : '#0f172a',
      fontSize: '14px',
      fontFamily: 'Inter, sans-serif',
      fontWeight: '500',
      lineHeight: '20px',
      '::placeholder': {
        color: isDarkMode ? '#64748b' : '#94a3b8',
      },
    },
    invalid: {
      color: '#dc2626',
      iconColor: '#dc2626',
    },
  },
});

const fieldShellClassName =
  'min-h-[50px] rounded-lg border border-slate-200 bg-white px-4 py-3 transition-all focus-within:border-slate-900 focus-within:ring-1 focus-within:ring-slate-900 dark:border-slate-700 dark:bg-[#0f1020] dark:focus-within:border-indigo-400 dark:focus-within:bg-[#111428] dark:focus-within:ring-indigo-500/10';

const readErrorMessage = (error: unknown, fallback: string): string => (
  error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
    ? error.message
    : fallback
);

/**
 * Formulário de CVV para cartão salvo da Stripe.
 * O objetivo aqui é manter a confirmação oficial, mas no estilo mais seco do checkout.
 * @since v1.0.0
 */
const StripeSavedCardCvcFormInner: React.FC<Omit<StripeSavedCardCvcFormProps, 'publishableKey'>> = ({
  formId,
  submitLabel = 'Confirmar cartão salvo',
  label = 'CVV',
  legalNotice,
  hideDescription = false,
  hideLabel = false,
  hideTrustNote = false,
  hideFieldHint = false,
  hideSubmitButton = false,
  onReadyChange,
  onConfirm,
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() =>
    typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : false,
  );
  const stripeReady = Boolean(stripe && elements);
  const elementOptions = useMemo(() => buildElementOptions(isDarkMode), [isDarkMode]);

  useEffect(() => {
    onReadyChange?.(stripeReady);

    return () => {
      onReadyChange?.(false);
    };
  }, [onReadyChange, stripeReady]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const root = document.documentElement;
    const updateTheme = () => setIsDarkMode(root.classList.contains('dark'));

    updateTheme();
    const observer = new MutationObserver(updateTheme);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });

    return () => observer.disconnect();
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      setError('O formulário seguro da Stripe ainda está carregando. Tente novamente em alguns segundos.');
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
    } catch (submitError: unknown) {
      setError(readErrorMessage(submitError, 'Não foi possível confirmar o cartão salvo.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form id={formId} onSubmit={handleSubmit} className="space-y-4">
      {!stripeReady ? (
        <div className="flex min-h-[140px] flex-col items-center justify-center rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/70 px-6 py-8 text-center text-indigo-700 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-200">
          <Loader2 size={24} className="animate-spin" />
          <p className="mt-4 text-sm font-black uppercase tracking-[0.16em]">
            Carregando validação segura
          </p>
          <p className="mt-2 max-w-sm text-xs font-semibold leading-relaxed text-indigo-500 dark:text-indigo-200/80">
            Aguarde enquanto a Stripe prepara o campo protegido de CVV.
          </p>
          {error ? <p className="mt-3 text-[11px] font-medium text-rose-500">{error}</p> : null}
        </div>
      ) : (
        <>
          {!hideDescription ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Confirme o código de segurança deste cartão salvo para concluir a compra.
            </p>
          ) : null}

          <div className="space-y-2">
            {!hideLabel ? (
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {label}
              </label>
            ) : null}
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
            {!hideFieldHint ? (
              fieldError ? (
                <p className="text-[11px] font-medium text-rose-500">{fieldError}</p>
              ) : (
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  O CVV não fica salvo na plataforma e será usado apenas nesta confirmação.
                </p>
              )
            ) : fieldError ? (
              <p className="text-[11px] font-medium text-rose-500">{fieldError}</p>
            ) : null}
          </div>

          {!hideTrustNote ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-700 dark:bg-[#111428]">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-full bg-emerald-100 p-2 text-emerald-600">
                  <Lock size={14} />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-slate-900 dark:text-slate-100">Confirmação segura</p>
                  <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                    A Stripe coleta o código de segurança novamente para confirmar a presença do titular.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {error ? <p className="text-[11px] font-medium text-rose-500">{error}</p> : null}

          {legalNotice}

          {!hideSubmitButton ? (
            <button
              type="submit"
              disabled={!stripe || !isComplete || submitting}
              className="flex h-[54px] w-full items-center justify-center gap-3 rounded-lg bg-emerald-600 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-emerald-500/25 transition-all hover:-translate-y-0.5 hover:bg-emerald-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
              {submitting ? 'Confirmando cartão salvo...' : submitLabel}
            </button>
          ) : null}
        </>
      )}
    </form>
  );
};

const StripeSavedCardCvcForm: React.FC<StripeSavedCardCvcFormProps> = ({
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
      <StripeSavedCardCvcFormInner onReadyChange={onReadyChange} {...props} />
    </Elements>
  );
};

export default StripeSavedCardCvcForm;
