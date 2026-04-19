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

/**
 * IDs oficiais dos formulários Stripe usados pela feature de checkout.
 * Permitem acionar o submit a partir de CTAs redundantes sem duplicar lógica.
 * @since v1.0.0
 */
export const CHECKOUT_STRIPE_FORM_IDS = {
  newCard: 'checkout-stripe-new-card-form',
  savedCard: 'checkout-stripe-saved-card-form',
} as const;

/**
 * Rótulos das etapas exibidas no header do checkout.
 * @since v1.0.0
 */
export const CHECKOUT_STEP_LABELS: Array<{ id: CheckoutStep; label: string }> = [
  { id: 'identification', label: 'Identificação' },
  { id: 'payment', label: 'Pagamento' },
  { id: 'success', label: 'Confirmação' },
];
