'use client';

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

import { AlertTriangle, Loader2, RotateCcw } from 'lucide-react';
import { PLATFORM_SURFACE_CARD_CLASS } from '@constants/layout';

type BillingSubscriptionLoadStateProps = {
  status: 'loading' | 'error';
  onRetry?: () => void;
};

/**
 * Evita estimar valores enquanto o snapshot financeiro autoritativo nao esta disponivel.
 */
export default function BillingSubscriptionLoadState({
  status,
  onRetry,
}: BillingSubscriptionLoadStateProps) {
  const failed = status === 'error';

  return (
    <div className="space-y-5">
      <section className={`${PLATFORM_SURFACE_CARD_CLASS} px-5 py-8 md:px-6`}>
        <div className="flex flex-col items-center justify-center gap-4 py-10 text-center">
          <span className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl border ${
            failed
              ? 'border-rose-100 bg-rose-50 text-rose-600 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300'
              : 'border-indigo-100 bg-indigo-50 text-indigo-600 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-300'
          }`}>
            {failed ? <AlertTriangle size={22} /> : <Loader2 size={22} className="animate-spin" />}
          </span>
          <div className="max-w-md space-y-2">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
              Assinatura
            </p>
            <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">
              {failed ? 'Nao foi possivel carregar sua assinatura' : 'Carregando assinatura'}
            </h2>
            <p className="text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">
              {failed
                ? 'Os valores e a vigencia nao serao estimados. Tente novamente para consultar os dados financeiros oficiais.'
                : 'Consultando valor, vigencia e renovacao registrados no financeiro da plataforma.'}
            </p>
          </div>
          {failed && onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-[9px] font-black uppercase tracking-[0.18em] text-white transition-colors hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
            >
              <RotateCcw size={14} />
              Tentar novamente
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}
