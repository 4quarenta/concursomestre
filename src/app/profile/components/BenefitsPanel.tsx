'use client';

import React, { useState } from 'react';
import { Gift, Loader2, CheckCircle2, Clock3, CalendarClock } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { benefitsService, type UserBenefit } from '@services/benefits';
import { readApiErrorMessage } from '@services/api';

const formatDate = (value: string | null): string => {
  if (!value) return 'A confirmar';
  const date = new Date(value.replace(' ', 'T') + (value.endsWith('Z') ? '' : 'Z'));
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('pt-BR');
};

const benefitLabel = (benefit: UserBenefit): string => {
  if (benefit.benefit_mode === 'BILLING_EXTENSION_ONLY') return 'Extensão da renovação';
  if (benefit.benefit_mode === 'ACCESS_AND_BILLING_EXTENSION') return 'Acesso + extensão da renovação';
  return 'Acesso temporário';
};

export default function BenefitsPanel({ userKey }: { userKey: string }): React.JSX.Element {
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const benefitsQuery = useQuery({
    queryKey: ['profile', 'benefits', userKey],
    queryFn: () => benefitsService.getMine(),
    enabled: Boolean(userKey),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
  const redemption = useMutation({
    mutationFn: () => benefitsService.redeemCode(code),
    onSuccess: async () => {
      setCode('');
      await queryClient.invalidateQueries({ queryKey: ['profile', 'benefits', userKey] });
    },
  });
  const snapshot = benefitsQuery.data;

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start gap-4">
          <span className="rounded-xl bg-indigo-50 p-3 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300"><Gift size={22} /></span>
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">Benefícios</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">Veja benefícios ativos e resgate um código recebido. Benefícios não alteram seu plano pago.</p>
          </div>
        </div>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Plano pago</p>
            <p className="mt-1 text-base font-black text-slate-900 dark:text-slate-100">{snapshot?.entitlement.paid_plan || 'Gratuito'}</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Acesso efetivo</p>
            <p className="mt-1 text-base font-black text-indigo-600 dark:text-indigo-300">{snapshot?.entitlement.effective_access || 'Gratuito'}</p>
          </div>
        </div>
        {snapshot?.entitlement.provider_current_period_end ? (
          <p className="mt-4 flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400"><CalendarClock size={15} /> Renovação confirmada: {formatDate(snapshot.entitlement.provider_current_period_end)}</p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">Resgatar código</h3>
        <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">O código será vinculado à sua conta e não altera uma assinatura Stripe por conta própria.</p>
        <form className="mt-4 flex flex-col gap-3 sm:flex-row" onSubmit={(event) => { event.preventDefault(); if (code.trim() && !redemption.isPending) redemption.mutate(); }}>
          <label className="sr-only" htmlFor="benefit-code">Código de benefício</label>
          <input id="benefit-code" value={code} onChange={(event) => setCode(event.target.value)} className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold uppercase outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" placeholder="Digite seu código" autoComplete="off" />
          <button type="submit" disabled={!code.trim() || redemption.isPending} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-xs font-black uppercase tracking-wider text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50">
            {redemption.isPending ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
            Resgatar
          </button>
        </form>
        {redemption.isSuccess ? <p className="mt-3 text-xs font-bold text-emerald-600">Código aceito. Benefícios de cobrança aparecem somente após confirmação do provedor.</p> : null}
        {redemption.isError ? <p role="alert" className="mt-3 text-xs font-bold text-rose-600">{readApiErrorMessage(redemption.error, 'Não foi possível resgatar este código.')}</p> : null}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between"><h3 className="text-sm font-black text-slate-900 dark:text-slate-100">Benefícios ativos</h3><span className="text-xs font-bold text-slate-400">{snapshot?.benefits.length || 0}</span></div>
        {benefitsQuery.isPending ? <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center dark:border-slate-800 dark:bg-slate-900"><Loader2 className="mx-auto animate-spin text-indigo-500" /></div> : null}
        {!benefitsQuery.isPending && (snapshot?.benefits.length || 0) === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm font-bold text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">Nenhum benefício ativo no momento.</div> : null}
        {snapshot?.benefits.map((benefit) => (
          <article key={benefit.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-4"><div><h4 className="text-sm font-black text-slate-900 dark:text-slate-100">{benefit.name}</h4><p className="mt-1 text-xs font-bold text-indigo-600 dark:text-indigo-300">{benefitLabel(benefit)}</p></div><span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"><CheckCircle2 size={12} /> Ativo</span></div>
            <div className="mt-4 grid gap-3 text-xs font-bold text-slate-500 sm:grid-cols-2 dark:text-slate-400"><span>Início: {formatDate(benefit.grant_starts_at)}</span><span>Expira: {formatDate(benefit.grant_expires_at)}</span></div>
            {benefit.billing_extension_days > 0 && benefit.provider_new_period_end ? <p className="mt-3 flex items-center gap-2 text-xs font-black text-emerald-700 dark:text-emerald-300"><Clock3 size={14} /> Nova renovação confirmada: {formatDate(benefit.provider_new_period_end)}</p> : null}
          </article>
        ))}
      </section>
    </div>
  );
}
