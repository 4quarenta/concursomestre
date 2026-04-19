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
import { Check } from 'lucide-react';
import { CHECKOUT_STEP_LABELS } from '../constants';
import type { CheckoutStep } from '../types';

interface CheckoutStepTrackerProps {
  step: CheckoutStep;
}

/**
 * Stepper horizontal da tela de checkout.
 * Mantém as três etapas visíveis e usa o mesmo vocabulário visual do produto.
 * @since v1.0.0
 */
const CheckoutStepTracker: React.FC<CheckoutStepTrackerProps> = ({ step }) => {
  const stepsOrder: CheckoutStep[] = ['identification', 'payment', 'success'];
  const currentIndex = Math.max(0, stepsOrder.indexOf(step));

  return (
    <div className="mb-5 rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-[0_10px_28px_rgba(46,60,108,0.04)] dark:border-slate-800 dark:bg-[#1a1c2e] md:mb-7 md:rounded-[1.4rem] md:px-5 md:py-4">
      <div className="grid grid-cols-3 gap-2 md:gap-4">
        {CHECKOUT_STEP_LABELS.map((checkoutStep, index) => {
          const isPast = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isLast = index === CHECKOUT_STEP_LABELS.length - 1;

          return (
            <div key={checkoutStep.id} className="flex min-w-0 items-center gap-2 md:gap-3">
              <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black md:h-7 md:w-7 md:text-xs ${
                isPast || isCurrent ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
              }`}>
                {isPast ? <Check size={13} /> : index + 1}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 md:gap-3">
                  <p className={`truncate text-[11px] font-black uppercase tracking-[0.08em] md:text-sm md:normal-case md:tracking-normal ${
                    isPast || isCurrent ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-500 dark:text-slate-400'
                  }`}>
                    {checkoutStep.label}
                  </p>
                  {!isLast ? (
                    <div className={`hidden h-px flex-1 lg:block ${
                      index < currentIndex ? 'bg-indigo-200 dark:bg-indigo-500/40' : 'bg-slate-200 dark:bg-slate-800'
                    }`} />
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CheckoutStepTracker;
