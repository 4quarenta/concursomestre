/**
 * Catalogo oficial usado no app mobile.
 * Mantem os mesmos contratos principais do frontend web.
 */
export const ENDPOINTS = {
  auth: {
    login: "auth/login.php",
    register: "auth/register.php",
    user: "auth/me.php",
    refresh: "auth/refresh.php",
    logout: "auth/logout.php",
    verifyTwoFactor: "auth/verify_2fa.php",
    resendConfirmation: "auth/resend-confirmation.php",
  },
  plans: {
    list: "plans/list.php",
  },
  questions: {
    // Contrato oficial de produção. Não existe uma rota mobile_list.php no backend.
    list: "questions/list.php",
    submit: "v2/questions/answer.php",
    stats: "questionsStats",
    history: "questionsHistory",
    toggleSave: "questionsToggleSave",
  },
  filters: {
    list: "filtersList",
  },
  blog: {
    list: "blog/list.php",
    detail: "blog/detail.php",
    like: "blog/like.php",
  },
  comments: {
    list: "commentsList",
    create: "commentsHandle",
    handle: "commentsHandle",
    like: "commentsLike",
  },
  simulations: {
    list: "simulationsList",
    create: "simulationsCreate",
  },
  rankings: {
    list: "rankingsList",
    join: "rankingsJoin",
  },
  materials: {
    list: "materialsList",
  },
  notifications: {
    list: "notificationsList",
    markRead: "notificationsMarkRead",
    markAllRead: "notificationsMarkAllRead",
    delete: "notificationsDelete",
    clearAll: "notificationsClearAll",
    restore: "notifications/restore.php",
    permanentDelete: "notifications/permanent-delete.php",
  },
  feedback: {
    list: "feedback/list.php",
    create: "feedback/create.php",
    testimonials: "feedback/testimonials.php",
  },
  profile: {
    get: "users/profile.php",
    update: "users/update.php",
  },
  users: {
    notes: "users/notes.php",
    deleteNote: "users/delete_note.php",
    uploadPhoto: "users/upload_photo.php",
    removePhoto: "users/remove_photo.php",
    listCards: "users/list_cards.php",
    removeCard: "users/remove_card.php",
    setDefaultCard: "users/set_default_card.php",
    changePassword: "users/change_password.php",
    deleteAccount: "users/delete_mobile.php",
  },
  subscriptions: {
    createStripeCheckout: "subscriptions/create_stripe_checkout.php",
    createStripeSubscription: "subscriptions/create_stripe_subscription.php",
    finalizeStripeSubscription:
      "subscriptions/finalize_stripe_subscription.php",
    validateCoupon: "subscriptions/validate_coupon.php",
    createStripePortal: "subscriptions/create_stripe_portal.php",
    updateRenewal: "subscriptions/update_renewal.php",
    cancel: "subscriptions/cancel.php",
    cancelRefund: "subscriptions/cancel_refund.php",
    undoCancel: "subscriptions/undo_cancel.php",
  },
  transactions: {
    list: "transactionsList",
    create: "transactions/create.php",
    refund: "transactions/refund.php",
  },
  statistics: {
    user: "statistics/user",
    xray: "statistics/xray.php",
  },
  settings: {
    get: "settings.php",
  },
  changelog: {
    list: "changelog/list.php",
  },
} as const;

export default ENDPOINTS;
