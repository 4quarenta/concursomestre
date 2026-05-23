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

import React from 'react';
import { CheckCircle2, Lock, RotateCcw, ShieldCheck } from 'lucide-react';

interface CheckoutPlanSummaryProps {
  planName: string;
  billingCycle: string;
  finalAmountLabel: string;
  renewalLabel: string;
  hasDiscount: boolean;
  benefits: string[];
}

const CheckoutPlanSummary: React.FC<CheckoutPlanSummaryProps> = ({
  planName,
  billingCycle,
  finalAmountLabel,
  renewalLabel,
  hasDiscount,
  benefits,
}) => {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-[#121528]">
      <div className="grid gap-0 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-4 p-5 md:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-indigo-50 px-3 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
              Assinatura
            </span>
            {hasDiscount && (
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
                Desconto aplicado
              </span>
            )}
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
              Você está assinando o plano
            </p>
            <h3 className="mt-1 text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              {planName}
            </h3>
          </div>

          <p className="max-w-2xl text-sm font-semibold leading-relaxed text-slate-500 dark:text-slate-400">
            O acesso é liberado após a confirmação do pagamento. A renovação pode ser gerenciada depois na área de assinatura.
          </p>
        </div>

        <div className="border-t border-slate-100 bg-slate-50 p-5 dark:border-slate-800 dark:bg-[#0f1020] lg:border-l lg:border-t-0 md:p-6">
          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Valor final</p>
          <p className="mt-2 whitespace-nowrap text-3xl font-black tracking-tight text-slate-900 dark:text-white">{finalAmountLabel}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-600 dark:bg-[#121528] dark:text-slate-300">
              {billingCycle}
            </span>
            <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-600 dark:bg-[#121528] dark:text-slate-300">
              Renovação {renewalLabel}
            </span>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-100 p-5 dark:border-slate-800 md:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Benefícios incluídos
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
              Recursos liberados com este plano.
            </p>
          </div>
          <ShieldCheck size={18} className="shrink-0 text-emerald-500" />
        </div>

        {benefits.length > 0 ? (
          <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {benefits.map((benefit) => (
              <div key={benefit} className="flex items-start gap-2.5">
                <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-500" />
                <span className="text-sm font-bold leading-relaxed text-slate-700 dark:text-slate-200">{benefit}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-500 dark:border-slate-800 dark:bg-[#0f1020] dark:text-slate-400">
            Nenhum benefício ativo cadastrado para este plano.
          </p>
        )}
      </div>

      <div className="grid border-t border-slate-100 bg-slate-50/80 dark:border-slate-800 dark:bg-[#0f1020] sm:grid-cols-3">
        {[
          { icon: ShieldCheck, title: 'Pagamento seguro', text: 'Processado em ambiente protegido.' },
          { icon: Lock, title: 'Dados protegidos', text: 'Cartão tokenizado pelo gateway.' },
          { icon: RotateCcw, title: '7 dias', text: 'Reembolso por arrependimento.' },
        ].map((item) => (
          <div key={item.title} className="flex items-start gap-3 border-t border-slate-100 px-5 py-4 first:border-t-0 dark:border-slate-800 sm:border-l sm:border-t-0 sm:first:border-l-0">
            <item.icon size={16} className="mt-0.5 shrink-0 text-emerald-500" />
            <div>
              <p className="text-xs font-black text-slate-900 dark:text-white">{item.title}</p>
              <p className="mt-1 text-[11px] font-semibold leading-relaxed text-slate-500 dark:text-slate-400">{item.text}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default CheckoutPlanSummary;
