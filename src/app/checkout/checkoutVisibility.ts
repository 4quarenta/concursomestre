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

import type { CheckoutStep } from './types';

type CheckoutVisibilityInput = {
  isAuthLoading: boolean;
  hasCurrentPlanMatch: boolean;
  checkoutCompletionInProgress: boolean;
  step: CheckoutStep;
};

export const shouldHideCheckoutForExistingSubscription = ({
  isAuthLoading,
  hasCurrentPlanMatch,
  checkoutCompletionInProgress,
  step,
}: CheckoutVisibilityInput): boolean => {
  if (checkoutCompletionInProgress || step === 'success') {
    return false;
  }

  if (isAuthLoading) {
    return true;
  }

  return hasCurrentPlanMatch;
};
