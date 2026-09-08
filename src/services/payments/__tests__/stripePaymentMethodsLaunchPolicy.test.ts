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

import { STRIPE_PAYMENT_METHOD_CATALOG } from '../stripePaymentMethodsConfig';

describe('stripe payment methods launch policy', () => {
  it('keeps recurring card enabled and PIX unavailable at launch', () => {
    const card = STRIPE_PAYMENT_METHOD_CATALOG.find((method) => method.id === 'card');
    const pix = STRIPE_PAYMENT_METHOD_CATALOG.find((method) => method.id === 'pix');

    expect(card?.enabled).toBe(true);
    expect(card?.checkoutSupported).toBe(true);
    expect(card?.recurringSupported).toBe(true);
    expect(pix?.enabled).toBe(false);
    expect(pix?.checkoutSupported).toBe(false);
  });
});
