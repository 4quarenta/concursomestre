/**
 * Catalogo oficial usado no app mobile.
 * Mantem os mesmos contratos principais do frontend web.
 * @since v1.0.0
 */
export const ENDPOINTS = {
  auth: {
    login: 'auth/login.php',
    register: 'auth/register.php',
    user: 'auth/me.php',
    refresh: 'auth/refresh.php',
    logout: 'auth/logout.php',
    resendConfirmation: 'auth/resend-confirmation.php',
  },
  plans: {
    list: 'plans/list.php',
  },
  questions: {
    list: 'questionsList',
    submit: 'questionsAnswer',
  },
  simulations: {
    list: 'simulationsList',
    create: 'simulationsCreate',
  },
  rankings: {
    list: 'rankingsList',
  },
  materials: {
    list: 'materialsList',
  },
  profile: {
    update: 'users/update.php',
  },
  users: {
    listCards: 'users/list_cards.php',
    removeCard: 'users/remove_card.php',
    setDefaultCard: 'users/set_default_card.php',
  },
  subscriptions: {
    createStripeCheckout: 'subscriptions/create_stripe_checkout.php',
    createStripeSubscription: 'subscriptions/create_stripe_subscription.php',
    finalizeStripeSubscription: 'subscriptions/finalize_stripe_subscription.php',
    validateCoupon: 'subscriptions/validate_coupon.php',
    createStripePortal: 'subscriptions/create_stripe_portal.php',
  },
  transactions: {
    list: 'transactionsList',
    create: 'transactions/create.php',
  },
  statistics: {
    user: 'statistics/user',
  },
} as const;

export default ENDPOINTS;
