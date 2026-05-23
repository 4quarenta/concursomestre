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
import { ArrowRight, Lock, Shield } from 'lucide-react';

interface CheckoutSummarySidebarProps {
  planName: string;
  billingCycle: string;
  paymentMethodLabel: string;
  renewalLabel: string;
  paymentProviderLabel: string;
  subtotalLabel: string;
  discountLabel?: string | null;
  migrationCreditLabel?: string | null;
  totalLabel: string;
  installmentLabel?: string | null;
  dueNowLabel: string;
  dueNowCaption: string;
  confirmLabel: string;
  processingLabel: string;
  processing: boolean;
  onConfirmClick: () => void;
  showConfirmButton?: boolean;
}

/**
 * Sidebar de resumo financeiro do checkout.
 * Mantem os mesmos totais da pagina principal e adiciona um CTA redundante para reduzir perda de conversao.
 * @since v1.0.0
 */
const CheckoutSummarySidebar: React.FC<CheckoutSummarySidebarProps> = ({
  planName,
  billingCycle,
  paymentMethodLabel,
  renewalLabel,
  paymentProviderLabel,
  subtotalLabel,
  discountLabel,
  migrationCreditLabel,
  totalLabel,
  installmentLabel,
  dueNowLabel,
  dueNowCaption,
  confirmLabel,
  processingLabel,
  processing,
  onConfirmClick,
  showConfirmButton = true,
}) => {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-1000">
      <div className="sticky top-8 overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60 transition-all dark:border-slate-800 dark:bg-[#1a1c2e] dark:shadow-none">
        <h2 className="mb-6 flex items-center gap-3 border-b border-slate-100 pb-4 text-sm font-black uppercase tracking-[0.2em] text-slate-900 dark:border-slate-800 dark:text-white">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
            <Lock size={16} />
          </div>
          Resumo financeiro
        </h2>

        <div className="space-y-5 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold uppercase tracking-widest text-slate-500">Plano</span>
            <span className="font-black text-slate-900 dark:text-white">{planName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-bold uppercase tracking-widest text-slate-500">Ciclo</span>
            <span className="rounded-lg bg-indigo-50 px-3 py-1 font-black uppercase tracking-tighter text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">{billingCycle}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-bold uppercase tracking-widest text-slate-500">Pagamento</span>
            <span className="font-black text-slate-900 dark:text-white">{paymentMethodLabel}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-bold uppercase tracking-widest text-slate-500">Renovação</span>
            <span className="font-black text-slate-900 dark:text-white">{renewalLabel}</span>
          </div>

          <div className="my-2 h-px bg-slate-100 dark:bg-slate-800" />

          <div className="space-y-3 rounded-2xl bg-slate-50 p-4 dark:bg-[#121528]">
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-500">Valor do ciclo</span>
              <span className="font-bold text-slate-900 dark:text-white">{subtotalLabel}</span>
            </div>

            {discountLabel ? (
              <div className="flex items-center justify-between font-bold text-emerald-600">
                <span>Desconto aplicado</span>
                <span>- {discountLabel}</span>
              </div>
            ) : null}

            {migrationCreditLabel ? (
              <div className="flex items-center justify-between font-bold text-emerald-600">
                <span>Crédito de migração</span>
                <span>- {migrationCreditLabel}</span>
              </div>
            ) : null}

            <div className="h-px bg-slate-200/70 dark:bg-slate-800" />

            <div className="flex items-center justify-between">
              <span className="font-black text-slate-700 dark:text-slate-200">Total final</span>
              <span className="font-black text-emerald-600">{totalLabel}</span>
            </div>

            {installmentLabel ? (
              <div className="flex items-center justify-between text-slate-500">
                <span>Parcelamento</span>
                <span className="font-bold text-slate-900 dark:text-white">{installmentLabel}</span>
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-between text-slate-500">
            <span>Gateway</span>
            <span className="font-bold text-slate-900 dark:text-white">{paymentProviderLabel}</span>
          </div>

          <div className="mt-6 border-t border-slate-100 pt-6 dark:border-slate-800">
            <div className="flex items-end justify-between gap-4">
              <div className="flex min-w-0 flex-col">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Hoje você paga</span>
                <span className="text-[11px] italic text-slate-400">{dueNowCaption}</span>
              </div>
              <div className="flex shrink-0 flex-col items-end">
                <span className="whitespace-nowrap text-2xl font-black tracking-tighter text-indigo-600 dark:text-indigo-400">{dueNowLabel}</span>
              </div>
            </div>

            {showConfirmButton ? (
              <button
                type="button"
                onClick={onConfirmClick}
                disabled={processing}
                className="mt-5 flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-emerald-600 text-[10px] font-black uppercase tracking-[0.2em] text-white transition-all hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {processing ? processingLabel : confirmLabel}
                {!processing ? <ArrowRight size={16} /> : null}
              </button>
            ) : null}

            <div className={`${showConfirmButton ? 'mt-3' : 'mt-5'} flex items-center justify-center gap-2 text-[10px] font-bold text-slate-500 dark:text-slate-400`}>
              <Shield size={14} />
              <span>Pagamento protegido e acesso liberado assim que aprovado.</span>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm dark:border-emerald-500/20 dark:bg-[#1a1c2e]">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">Segurança e controle</p>
        <div className="mt-4 space-y-3">
          {[
            ['Pagamento seguro', 'Transação processada por gateway protegido.'],
            ['Dados protegidos', 'O cartão é validado em ambiente seguro.'],
            ['Reembolso em 7 dias', 'Solicitação disponível em caso de arrependimento.'],
          ].map(([title, text]) => (
            <div key={title} className="flex items-start gap-3">
              <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
              <div>
                <p className="text-xs font-black text-slate-900 dark:text-white">{title}</p>
                <p className="mt-1 text-[11px] font-semibold leading-relaxed text-slate-500 dark:text-slate-400">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CheckoutSummarySidebar;
