'use client';

import React from 'react';
import { AlertTriangle, CreditCard, Lock } from 'lucide-react';

interface GlobalPaymentIssueBannerProps {
  message: string;
  blocking?: boolean;
  actionLabel?: string;
  onAction?: () => void;
}

const GlobalPaymentIssueBanner: React.FC<GlobalPaymentIssueBannerProps> = ({
  message,
  blocking = false,
  actionLabel = 'Cadastrar cartão',
  onAction,
}) => {
  return (
    <div
      className={`mb-4 rounded-[1.5rem] border px-4 py-4 shadow-sm md:px-5 ${
        blocking
          ? 'border-rose-200 bg-rose-50 dark:border-rose-500/20 dark:bg-rose-500/10'
          : 'border-amber-200 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/10'
      }`}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div
            className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg ${
              blocking
                ? 'bg-rose-500 shadow-rose-500/20'
                : 'bg-amber-500 shadow-amber-500/20'
            }`}
          >
            {blocking ? <Lock size={18} /> : <AlertTriangle size={18} />}
          </div>

          <div className="min-w-0">
            <p
              className={`text-[10px] font-black uppercase tracking-[0.18em] ${
                blocking
                  ? 'text-rose-700 dark:text-rose-300'
                  : 'text-amber-700 dark:text-amber-300'
              }`}
            >
              Atenção no pagamento
            </p>
            <p className="mt-1 text-sm font-semibold leading-6 text-slate-700 dark:text-slate-200">
              {message}
            </p>
            {blocking ? (
              <p className="mt-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Use a ação ao lado para concluir a regularização no ambiente seguro de pagamento.
              </p>
            ) : null}
          </div>
        </div>

        {onAction ? (
          <button
            type="button"
            onClick={onAction}
            className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-white transition-all ${
              blocking
                ? 'bg-rose-600 hover:bg-rose-700'
                : 'bg-amber-500 hover:bg-amber-600'
            }`}
          >
            <CreditCard size={14} />
            {actionLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
};

export default GlobalPaymentIssueBanner;
