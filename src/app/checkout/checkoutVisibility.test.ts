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

import { describe, expect, it } from 'vitest';
import { shouldHideCheckoutForExistingSubscription } from './checkoutVisibility';

describe('checkout visibility after payment', () => {
  it('hides a repeated purchase before checkout completion', () => {
    expect(shouldHideCheckoutForExistingSubscription({
      isAuthLoading: false,
      hasCurrentPlanMatch: true,
      checkoutCompletionInProgress: false,
      step: 'payment',
    })).toBe(true);
  });

  it('keeps rendering while the newly purchased plan is being finalized', () => {
    expect(shouldHideCheckoutForExistingSubscription({
      isAuthLoading: false,
      hasCurrentPlanMatch: true,
      checkoutCompletionInProgress: true,
      step: 'payment',
    })).toBe(false);
  });

  it('always renders the congratulations step after approval', () => {
    expect(shouldHideCheckoutForExistingSubscription({
      isAuthLoading: false,
      hasCurrentPlanMatch: true,
      checkoutCompletionInProgress: true,
      step: 'success',
    })).toBe(false);
  });
});
