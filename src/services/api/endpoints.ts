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

/**
 * Catalogo oficial de endpoints consumidos pelo frontend.
 * Ele reduz strings soltas e ajuda a migracao da camada legada.
 * @since 1.0.0
 */
export const ENDPOINTS = {
    auth: {
        login: 'auth/login.php',
        register: 'auth/register.php',
        forgotPassword: 'auth/forgot-password.php',
        verifyTwoFactor: 'auth/verify_2fa.php',
        confirmEmail: 'auth/confirm-email.php',
        logout: 'auth/logout.php',
        refresh: 'auth/refresh.php',
        resetPassword: 'auth/reset-password.php',
        user: 'auth/me.php',
        resendConfirmation: 'auth/resend-confirmation.php',
        setupTwoFactor: 'auth/setup_2fa.php',
        enableTwoFactor: 'auth/enable_2fa.php',
    },

    changelog: {
        list: 'changelog/list.php',
    },

    questions: {
        list: 'questionsList',
        show: 'questions/show.php',
        create: 'questionsCreate',
        update: 'questionsUpdate',
        delete: 'questionsDelete',
        submit: 'questionsAnswer',
        answer: 'questionsAnswer',
        save: 'questionsSave',
        filter: 'questionsFilter',
        stats: 'questionsStats',
        history: 'questionsHistory',
        toggleSave: 'questionsToggleSave',
        resetAnswers: 'questionsResetAnswers',
    },

    comments: {
        list: 'commentsList',
        create: 'commentsHandle',
        add: 'commentsAdd',
        update: 'commentsHandle',
        delete: 'commentsHandle',
        like: 'commentsLike',
        report: 'commentsReport',
        handle: 'commentsHandle',
    },

    notifications: {
        list: 'notificationsList',
        markRead: 'notificationsMarkRead',
        markAllRead: 'notificationsMarkAllRead',
        delete: 'notificationsDelete',
        clearAll: 'notificationsClearAll',
        send: 'notificationsSend',
    },

    rankings: {
        list: 'rankingsList',
        create: 'rankingsCreate',
        join: 'rankingsJoin',
        update: 'rankingsUpdate',
        moderate: 'rankingsModerate',
        delete: 'rankingsDelete',
    },

    materials: {
        list: 'materialsList',
        create: 'materialsCreate',
        update: 'materialsUpdate',
        delete: 'materialsDelete',
        moderate: 'materialsModerate',
        rate: 'materialsRate',
        access: 'materials/access.php',
        download: 'materials/download.php',
        getBookmarks: 'materials/get_bookmarks.php',
        saveBookmark: 'materials/save_bookmark.php',
        deleteBookmark: 'materials/delete_bookmark.php',
        getHighlights: 'materials/get_highlights.php',
        saveHighlight: 'materials/save_highlight.php',
        deleteHighlight: 'materials/delete_highlight.php',
        getNote: 'materials/get_note.php',
        saveNote: 'materials/save_note.php',
        upload: 'upload.php',
    },

    marketplace: {
        list: 'marketplaceList',
        purchase: 'marketplacePurchase',
        create: 'marketplaceCreate',
        userTransactions: 'marketplaceUserTransactions',
        processTransaction: 'marketplaceProcessTransaction',
        refund: 'marketplaceRefund',
        myMaterials: 'marketplaceMyMaterials',
    },

    simulations: {
        list: 'simulationsList',
        create: 'simulationsCreate',
        submit: 'simulationsSubmit',
    },

    users: {
        list: 'usersList',
        profile: 'users/profile.php',
        update: 'users/update.php',
        comments: 'usersComments',
        answers: 'users/answers.php',
        notes: 'users/notes.php',
        materials: 'users/materials.php',
        referralStats: 'referrals/stats.php',
        uploadPhoto: 'users/upload_photo.php',
        changePassword: 'users/change_password.php',
        listCards: 'users/list_cards.php',
        removeCard: 'users/remove_card.php',
        setDefaultCard: 'users/set_default_card.php',
        saveCard: 'users/save_card.php',
        createStripeSetupIntent: 'users/create_stripe_setup_intent.php',
        syncStripeCard: 'users/sync_stripe_card.php',
    },

    reports: {
        create: 'reportsCreate',
        list: 'reportsList',
    },

    filters: {
        list: 'filtersList',
        save: 'filtersSave',
        delete: 'filtersDelete',
    },

    plans: {
        list: 'plans/list.php',
    },

    admin: {
        listTables: 'admin/list_tables.php',
        resetDatabase: 'admin/reset_db.php',
        userDetails: 'admin/user_details.php',
        userActions: 'admin/user_actions.php',
        feedback: 'admin/feedback.php',
        reportActions: 'admin/report_actions.php',
        stats: 'admin/stats.php',
    },

    subscriptions: {
        automationHelper: 'subscriptions/automation_helper.php',
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
        approveRefund: 'transactions/approve_refund.php',
        rejectRefund: 'transactions/reject_refund.php',
    },

    payments: {
        installments: 'payments/get-installments.php',
        processMaterial: 'payments/process-payment.php',
    },

    feedback: {
        list: 'feedback/list.php',
        create: 'feedback/create.php',
    },

    cache: {
        manage: 'admin/cache.php',
    },

    bankAnalysis: {
        analyze: 'bankAnalysisAnalyze',
        patterns: 'bankAnalysisPatterns',
        board: 'analysis/board',
        user: 'analysis/user',
        insights: 'analysis/patterns',
    },

    ai: {
        generate: 'aiGenerate',
    },

    settings: {
        get: 'settings.php',
        update: 'admin/settings.php',
    },

    statistics: {
        user: 'statistics/user',
        question: 'statistics/question',
        platform: 'statistics/platform',
        xray: 'statistics/xray.php',
        bancaInfo: 'statistics/banca_info.php',
        studySession: 'statistics/study-session.php',
    },

    system: {
        logs: 'system/logs.php',
    },
} as const;

export default ENDPOINTS;
