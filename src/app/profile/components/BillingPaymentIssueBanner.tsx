'use client';

import { ShieldAlert } from 'lucide-react';
import type { ResolvedPaymentIssue } from '@services/billing/paymentIssue';

type BillingPaymentIssueBannerProps = {
  issue: ResolvedPaymentIssue;
  onResolve: () => void;
};

export default function BillingPaymentIssueBanner({ issue, onResolve }: BillingPaymentIssueBannerProps) {
  const isExpiryWarning = issue.type === 'expiring_card';

  return (
    <div className={`rounded-[1.5rem] border px-4 py-4 ${isExpiryWarning ? 'border-amber-200 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/10' : 'border-rose-200 bg-rose-50 dark:border-rose-500/20 dark:bg-rose-500/10'}`}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 rounded-2xl p-2.5 text-white shadow-lg ${isExpiryWarning ? 'bg-amber-500 shadow-amber-500/20' : 'bg-rose-500 shadow-rose-500/20'}`}>
            <ShieldAlert size={16} />
          </div>
          <div className="space-y-1">
            <p className={`text-[9px] font-black uppercase tracking-[0.18em] ${isExpiryWarning ? 'text-amber-700 dark:text-amber-300' : 'text-rose-600 dark:text-rose-300'}`}>Atenção no pagamento</p>
            <p className="text-xs font-semibold leading-5 text-slate-700 dark:text-slate-200">
              {issue.message || 'Atualize sua forma de pagamento para evitar interrupções no acesso.'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onResolve}
          className="h-10 rounded-xl bg-slate-900 px-4 text-[9px] font-black uppercase tracking-[0.18em] text-white transition-all hover:bg-slate-800 dark:bg-rose-500 dark:text-slate-950"
        >
          {issue.actionLabel || 'Resolver'}
        </button>
      </div>
    </div>
  );
}
