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
import { Lock } from 'lucide-react';
import PublicBrandLink from '../../../components/shared/layout/PublicBrandLink';

/**
 * Barra superior enxuta do checkout.
 * Mantém apenas marca e sinal de segurança para reduzir ruído visual.
 * @since v1.0.0
 */
const CheckoutHeader: React.FC = () => {
  return (
    <header className="mb-5 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-slate-800 dark:bg-[#1a1c2e]">
      <div className="flex flex-col gap-3 px-4 py-4 sm:px-5 sm:py-5 md:flex-row md:items-center md:justify-between">
        <PublicBrandLink
          className="flex items-center gap-3 text-indigo-600 transition-opacity hover:opacity-90"
          iconClassName="text-indigo-600"
          labelClassName="text-[1.55rem] sm:text-[1.9rem] font-black tracking-tight text-indigo-600"
          iconSize={28}
        />

        <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-slate-300">
          <Lock className="size-4 text-emerald-500" />
          <span>Pagamento seguro</span>
        </div>
      </div>
    </header>
  );
};

export default CheckoutHeader;
