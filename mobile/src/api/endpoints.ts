/**
 * Catalogo oficial usado no app mobile.
 * Mantem os mesmos contratos principais do frontend web.
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
    list: 'questions/mobile_list.php',
    submit: 'questionsAnswer',
    stats: 'questionsStats',
    history: 'questionsHistory',
    toggleSave: 'questionsToggleSave',
  },
  filters: {
    list: 'filtersList',
  },
  comments: {
    list: 'commentsList',
    create: 'commentsHandle',
    handle: 'commentsHandle',
    like: 'commentsLike',
  },
  simulations: {
    list: 'simulationsList',
    create: 'simulationsCreate',
  },
  rankings: {
    list: 'rankingsList',
    join: 'rankingsJoin',
  },
  materials: {
    list: 'materialsList',
  },
  notifications: {
    list: 'notificationsList',
    markRead: 'notificationsMarkRead',
    markAllRead: 'notificationsMarkAllRead',
    delete: 'notificationsDelete',
    clearAll: 'notificationsClearAll',
  },
  feedback: {
    list: 'feedback/list.php',
    create: 'feedback/create.php',
  },
  profile: {
    update: 'users/update.php',
  },
  users: {
    notes: 'users/notes.php',
    deleteNote: 'users/delete_note.php',
    listCards: 'users/list_cards.php',
    removeCard: 'users/remove_card.php',
    setDefaultCard: 'users/set_default_card.php',
    changePassword: 'users/change_password.php',
    deleteAccount: 'users/delete_mobile.php',
  },
  subscriptions: {
    createStripeCheckout: 'subscriptions/create_stripe_checkout.php',
    createStripeSubscription: 'subscriptions/create_stripe_subscription.php',
    finalizeStripeSubscription: 'subscriptions/finalize_stripe_subscription.php',
    validateCoupon: 'subscriptions/validate_coupon.php',
    createStripePortal: 'subscriptions/create_stripe_portal.php',
    updateRenewal: 'subscriptions/update_renewal.php',
    cancel: 'subscriptions/cancel.php',
    cancelRefund: 'subscriptions/cancel_refund.php',
    undoCancel: 'subscriptions/undo_cancel.php',
  },
  transactions: {
    list: 'transactionsList',
    create: 'transactions/create.php',
    refund: 'transactions/refund.php',
  },
  statistics: {
    user: 'statistics/user',
    xray: 'statistics/xray.php',
  },
  settings: {
    get: 'settings.php',
  },
  changelog: {
    list: 'changelog/list.php',
  },
} as const;

export default ENDPOINTS;
