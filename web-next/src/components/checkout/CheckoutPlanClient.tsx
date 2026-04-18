'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Loader2,
  Lock,
  ShieldCheck,
  Sparkles,
  TicketPercent,
} from 'lucide-react';
import { useAuthSession } from '@/components/auth/AuthSessionProvider';
import { readApiData, readApiErrorMessage } from '@/lib/browserApi';
import { requestAuthenticatedApi } from '@/lib/authSession';
import {
  calculatePlanAutoCouponDiscount,
  getCanonicalPlanName,
  getConfiguredPlanDisplayName,
  resolveBestPlanAutoCoupon,
  resolvePlanOffer,
} from '@/services/plans';
import type { DiscountCode, Plan, SystemSettings } from '@/types';

type CheckoutPlanClientProps = {
  plan: Plan | null;
  planId: string;
  systemSettings: SystemSettings;
};

type AppliedCoupon = {
  code: string;
  discountAmount: number;
  source: 'auto' | 'manual';
};

const formatCurrency = (value: number) => `R$ ${Number(value || 0).toLocaleString('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})}`;

const getCycleCopy = (plan: Plan) => {
  if (plan.interval_unit === 'year') {
    return {
      installments: 12,
      label: 'anual',
      recurrence: 'ciclo anual',
    };
  }

  if (plan.interval_unit === 'month' && Number(plan.interval_count || 1) === 3) {
    return {
      installments: 3,
      label: 'trimestral',
      recurrence: 'ciclo trimestral',
    };
  }

  return {
    installments: 1,
    label: 'mensal',
    recurrence: 'ciclo mensal',
  };
};

const resolveCouponAmount = (coupon: DiscountCode, amount: number) => {
  const raw = coupon as DiscountCode & Record<string, any>;
  if (Number(raw.discount_amount || raw.discountAmount || 0) > 0) {
    return Math.min(amount, Number(raw.discount_amount || raw.discountAmount || 0));
  }

  return calculatePlanAutoCouponDiscount(coupon, amount);
};

export default function CheckoutPlanClient({ plan, planId, systemSettings }: CheckoutPlanClientProps) {
  const { currentUser, isAuthenticated, isLoading } = useAuthSession();
  const [autoRenew, setAutoRenew] = useState(true);
  const [couponCode, setCouponCode] = useState('');
  const [manualCoupon, setManualCoupon] = useState<AppliedCoupon | null>(null);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [isStartingCheckout, setIsStartingCheckout] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const autoCoupon = useMemo(() => {
    if (!plan) return null;
    const coupon = resolveBestPlanAutoCoupon(systemSettings.coupons || [], plan);
    if (!coupon) return null;

    return {
      code: coupon.code,
      discountAmount: calculatePlanAutoCouponDiscount(coupon, Number(plan.price || 0)),
      source: 'auto' as const,
    };
  }, [plan, systemSettings.coupons]);

  const appliedCoupon = manualCoupon || autoCoupon;
  const offer = useMemo(() => {
    if (!plan) return null;

    return resolvePlanOffer({
      plan,
      pricing: systemSettings.pricing,
      planDetails: systemSettings.planDetails,
      discountAmount: appliedCoupon?.discountAmount || 0,
    });
  }, [appliedCoupon?.discountAmount, plan, systemSettings.planDetails, systemSettings.pricing]);

  const cycleCopy = useMemo(() => plan ? getCycleCopy(plan) : null, [plan]);
  const canonicalPlanName = plan ? getCanonicalPlanName(plan.name) : null;
  const displayName = plan
    ? getConfiguredPlanDisplayName(plan.name, systemSettings.planDetails, plan.name)
    : `Plano ${planId}`;
  const featureList = useMemo(() => {
    if (!plan || !canonicalPlanName) return [];

    const configuredFeatures = systemSettings.planDetails?.[canonicalPlanName]?.features;
    const sourceFeatures = Array.isArray(configuredFeatures) && configuredFeatures.length > 0
      ? configuredFeatures
      : plan.features;

    return (sourceFeatures || [])
      .filter((feature) => feature?.included)
      .map((feature) => String(feature.text || '').trim())
      .filter(Boolean)
      .slice(0, 8);
  }, [canonicalPlanName, plan, systemSettings.planDetails]);

  const handleApplyCoupon = async () => {
    if (!plan || !offer) return;
    const normalizedCode = couponCode.trim();

    if (!normalizedCode) {
      setManualCoupon(null);
      setMessage(null);
      return;
    }

    setIsApplyingCoupon(true);
    setMessage(null);

    try {
      const response = await requestAuthenticatedApi<any>('subscriptions/validate_coupon.php', {
        method: 'POST',
        body: {
          code: normalizedCode,
          amount: offer.originalCycleAmount,
          plan_id: plan.id,
          target_type: 'plan',
          target_id: plan.id,
        },
      });

      const payload = readApiData<any>(response, {});
      const coupon = payload?.coupon || response?.coupon;

      if (!coupon) {
        throw new Error('Cupom invalido ou indisponivel para este plano.');
      }

      setManualCoupon({
        code: coupon.code || normalizedCode,
        discountAmount: resolveCouponAmount(coupon, offer.originalCycleAmount),
        source: 'manual',
      });
      setMessage({ type: 'success', text: 'Cupom aplicado ao checkout.' });
    } catch (error) {
      setManualCoupon(null);
      setMessage({ type: 'error', text: readApiErrorMessage(error, 'Nao foi possivel validar este cupom.') });
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const handleStartCheckout = async () => {
    if (!plan || !offer || !cycleCopy) return;

    setIsStartingCheckout(true);
    setMessage(null);

    try {
      const response = await requestAuthenticatedApi<any>('subscriptions/create_stripe_checkout.php', {
        method: 'POST',
        body: {
          plan_id: plan.id,
          auto_renew: autoRenew,
          coupon_code: appliedCoupon?.code || undefined,
          billing_mode: 'single_installment',
          installment_count: cycleCopy.installments,
        },
      });

      const payload = readApiData<any>(response, {});
      const checkoutUrl = response?.url || response?.redirect_url || payload?.url || payload?.redirect_url;

      if (!checkoutUrl) {
        throw new Error('O backend nao retornou uma URL de checkout.');
      }

      window.location.assign(checkoutUrl);
    } catch (error) {
      setMessage({
        type: 'error',
        text: readApiErrorMessage(error, 'Nao foi possivel iniciar o checkout Stripe.'),
      });
      setIsStartingCheckout(false);
    }
  };

  if (!plan) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <section className="mx-auto flex max-w-3xl flex-col gap-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <Link href="/planos" className="inline-flex w-fit items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
            <ArrowLeft size={14} />
            Voltar aos planos
          </Link>
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
            <AlertTriangle size={24} />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-black tracking-tight">Plano nao encontrado</h1>
            <p className="text-sm font-medium leading-7 text-slate-500 dark:text-slate-400">
              Nao encontramos o plano `{planId}` no catalogo atual. Confira a pagina de planos ativos para escolher uma oferta disponivel.
            </p>
          </div>
          <Link
            href="/planos"
            className="inline-flex w-fit items-center justify-center rounded-2xl bg-slate-900 px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-white transition hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500"
          >
            Ver planos
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[minmax(0,1fr)_440px]">
        <section className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-8">
          <Link href="/planos" className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
            <ArrowLeft size={14} />
            Planos
          </Link>

          <div className="space-y-4">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-indigo-600 dark:text-indigo-300">
              Checkout seguro
            </p>
            <div className="space-y-3">
              <h1 className="text-4xl font-black tracking-tight md:text-5xl">{displayName}</h1>
              <p className="max-w-3xl text-sm font-medium leading-7 text-slate-500 dark:text-slate-400">
                {plan.description || 'Finalize sua assinatura com processamento seguro e acesso liberado apos a confirmacao do pagamento.'}
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950/40">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Plano</p>
              <p className="mt-2 text-lg font-black">{canonicalPlanName}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950/40">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Ciclo</p>
              <p className="mt-2 text-lg font-black">{cycleCopy?.label}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950/40">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Protecao</p>
              <p className="mt-2 text-lg font-black">Stripe</p>
            </div>
          </div>

          {featureList.length > 0 ? (
            <div className="space-y-4">
              <h2 className="text-xl font-black">O que esta incluso</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {featureList.map((feature) => (
                  <div key={feature} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                    <CheckCircle2 className="mt-0.5 flex-none text-emerald-500" size={18} />
                    <p className="text-sm font-semibold leading-6 text-slate-700 dark:text-slate-300">{feature}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-5 dark:border-indigo-900/30 dark:bg-indigo-950/20">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 text-indigo-600 dark:text-indigo-300" size={20} />
              <div className="space-y-1">
                <h2 className="text-base font-black">Pagamento protegido</h2>
                <p className="text-sm font-medium leading-6 text-slate-600 dark:text-slate-300">
                  O processamento financeiro acontece no fluxo seguro da Stripe, com retorno automatico para a plataforma apos a confirmacao.
                </p>
              </div>
            </div>
          </div>
        </section>

        <aside className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:p-8 lg:sticky lg:top-6 lg:h-fit">
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400 dark:text-slate-500">
              Resumo
            </p>
            <h2 className="text-2xl font-black">{displayName}</h2>
          </div>

          {offer ? (
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950/40">
              {offer.hasDiscount ? (
                <p className="text-sm font-bold text-slate-400 line-through">
                  {formatCurrency(offer.originalCycleAmount)}
                </p>
              ) : null}
              <p className="text-4xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">
                {formatCurrency(offer.discountedCycleAmount)}
              </p>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                {cycleCopy?.recurrence}
              </p>
              {appliedCoupon ? (
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                  <Sparkles size={12} />
                  Cupom {appliedCoupon.code}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Cupom
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={couponCode}
                onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
                placeholder="CODIGO"
                className="h-12 min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-black uppercase outline-none transition focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
              <button
                type="button"
                onClick={handleApplyCoupon}
                disabled={isApplyingCoupon || !isAuthenticated}
                className="inline-flex h-12 items-center justify-center rounded-2xl bg-slate-900 px-4 text-xs font-black uppercase tracking-[0.16em] text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-indigo-600 dark:hover:bg-indigo-500"
              >
                {isApplyingCoupon ? <Loader2 className="animate-spin" size={16} /> : <TicketPercent size={16} />}
              </button>
            </div>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
            <input
              type="checkbox"
              checked={autoRenew}
              onChange={(event) => setAutoRenew(event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600"
            />
            <span className="space-y-1">
              <span className="block text-sm font-black">Renovacao automatica</span>
              <span className="block text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">
                Mantem o acesso ativo ao fim do ciclo, conforme configuracao do plano.
              </span>
            </span>
          </label>

          {message ? (
            <div className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
              message.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-300'
                : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/30 dark:bg-rose-950/20 dark:text-rose-300'
            }`}>
              {message.text}
            </div>
          ) : null}

          {!isAuthenticated && !isLoading ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/30 dark:bg-amber-950/20">
              <div className="flex items-start gap-3">
                <Lock className="mt-0.5 text-amber-700 dark:text-amber-300" size={18} />
                <p className="text-sm font-medium leading-6 text-amber-800 dark:text-amber-200">
                  Entre na sua conta antes de iniciar o pagamento.
                </p>
              </div>
            </div>
          ) : null}

          {isAuthenticated ? (
            <button
              type="button"
              onClick={handleStartCheckout}
              disabled={isStartingCheckout || isLoading}
              className="inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-emerald-500 px-5 py-4 text-xs font-black uppercase tracking-[0.18em] text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-wait disabled:opacity-60"
            >
              {isStartingCheckout ? <Loader2 className="animate-spin" size={16} /> : <CreditCard size={16} />}
              Ir para pagamento
            </button>
          ) : (
            <Link
              href={`/auth?next=${encodeURIComponent(`/checkout/${plan.id}`)}`}
              className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-5 py-4 text-xs font-black uppercase tracking-[0.18em] text-white transition hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500"
            >
              Entrar para pagar
            </Link>
          )}

          <p className="text-center text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
            Garantia e termos conforme contrato de adesao
          </p>
        </aside>
      </div>
    </main>
  );
}
