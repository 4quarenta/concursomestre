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

import { useCallback, useMemo } from 'react';
import { CHECKOUT_STRIPE_FORM_IDS } from '../constants';

interface UseCheckoutSummaryActionParams {
  isStripeInternalCheckout: boolean;
  isUsingStripeSavedCard: boolean;
  paymentActionLabel: string;
  handlePayment: () => Promise<void> | void;
}

/**
 * Concentra o comportamento do CTA redundante do resumo financeiro.
 * O hook garante que a sidebar reutilize o fluxo oficial em vez de criar atalhos paralelos.
 * @since v1.0.0
 */
export const useCheckoutSummaryAction = ({
  isStripeInternalCheckout,
  isUsingStripeSavedCard,
  paymentActionLabel,
  handlePayment,
}: UseCheckoutSummaryActionParams) => {
  const summaryConfirmLabel = useMemo(() => {
    if (!isStripeInternalCheckout) {
      return paymentActionLabel;
    }

    return 'Garantir assinatura';
  }, [isStripeInternalCheckout, paymentActionLabel]);

  const handleSummaryPaymentAction = useCallback(() => {
    if (!isStripeInternalCheckout) {
      void handlePayment();
      return;
    }

    const targetFormId = isUsingStripeSavedCard
      ? CHECKOUT_STRIPE_FORM_IDS.savedCard
      : CHECKOUT_STRIPE_FORM_IDS.newCard;

    const form = document.getElementById(targetFormId) as HTMLFormElement | null;
    form?.requestSubmit();
  }, [handlePayment, isStripeInternalCheckout, isUsingStripeSavedCard]);

  return {
    summaryConfirmLabel,
    handleSummaryPaymentAction,
  };
};

export default useCheckoutSummaryAction;

