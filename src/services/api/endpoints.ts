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
        google: 'auth/google.php',
        facebook: 'auth/facebook.php',
        apple: 'auth/apple.php',
        resetPassword: 'auth/reset-password.php',
        user: 'auth/me.php',
        resendConfirmation: 'auth/resend-confirmation.php',
        setupTwoFactor: 'auth/setup_2fa.php',
        enableTwoFactor: 'auth/enable_2fa.php',
    },

    changelog: {
        list: 'changelog/list.php',
    },

    setup: {
        status: 'setup/status.php',
        install: 'setup/install.php',
    },

    questions: {
        list: 'questionsList',
        show: 'questions/show.php',
        edit: 'questions/edit.php',
        create: 'questionsCreate',
        examImport: 'questionsExamImport',
        examFiles: 'questions/exam-files.php',
        bulkImport: 'questionsBulkImport',
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
        groups: 'questions/groups.php',
        editorialFeedback: 'questions/editorial-feedback.php',
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
        list: 'notifications/list.php',
        markRead: 'notifications/mark_read.php',
        markAllRead: 'notifications/mark_all_read.php',
        delete: 'notifications/delete.php',
        clearAll: 'notifications/clear_all.php',
        restore: 'notifications/restore.php',
        permanentDelete: 'notifications/permanent-delete.php',
        send: 'notifications/send.php',
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

    studySchedule: {
        get: 'study-schedule/get.php',
        save: 'study-schedule/save.php',
        delete: 'study-schedule/delete.php',
    },

    users: {
        list: 'usersList',
        profile: 'users/profile.php',
        update: 'users/update.php',
        comments: 'users/comments.php',
        answers: 'users/answers.php',
        notes: 'users/notes.php',
        materials: 'users/materials.php',
        referralStats: 'referrals/stats.php',
        uploadPhoto: 'users/upload_photo.php',
        removePhoto: 'users/remove_photo.php',
        changePassword: 'users/change_password.php',
        delete: 'users/delete.php',
        levelLeaderboard: 'users/level_leaderboard.php',
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
        plansCatalog: 'admin/plans.php',
        feedback: 'admin/feedback.php',
        reportActions: 'admin/report_actions.php',
        stats: 'admin/stats.php',
        analyticsFinance: 'admin/analytics_finance.php',
        analyticsDashboard: 'admin/analytics_dashboard.php',
        analyticsFunnel: 'admin/analytics_funnel.php',
        analyticsFunnelExport: 'admin/analytics_funnel_export.php',
        analyticsSegments: 'admin/analytics_segments.php',
        analyticsSegmentsExport: 'admin/analytics_segments_export.php',
        commentsModeration: 'admin/comments_moderation.php',
        commentsModerationBulk: 'admin/comments_moderation_bulk.php',
        commentsModerationExport: 'admin/comments_moderation_export.php',
        securityIps: 'admin/security_ips.php',
        logs: 'admin/logs.php',
    },

    subscriptions: {
        automationHelper: 'subscriptions/automation_helper.php',
        stripeTestingMatrix: 'subscriptions/stripe_testing_matrix.php',
        stripeTestingRuns: 'subscriptions/stripe_testing_runs.php',
        createStripeCheckout: 'subscriptions/create_stripe_checkout.php',
        createStripeSubscription: 'subscriptions/create_stripe_subscription.php',
        finalizeStripeSubscription: 'subscriptions/finalize_stripe_subscription.php',
        stripePixCapability: 'subscriptions/stripe_pix_capability.php',
        validateCoupon: 'subscriptions/validate_coupon.php',
        createStripePortal: 'subscriptions/create_stripe_portal.php',
        updateRenewal: 'subscriptions/update_renewal.php',
        syncCurrent: 'subscriptions/sync_current.php',
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
        testimonials: 'feedback/testimonials.php',
        vote: 'feedback/vote.php',
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

    analytics: {
        track: 'analytics/track.php',
    },

    legalCommentary: {
        list: 'legal-commentary/list.php',
        detail: 'legal-commentary/detail.php',
        favorite: 'legal-commentary/favorite.php',
        progress: 'legal-commentary/progress.php',
        comment: 'legal-commentary/comment.php',
        adminList: 'legal-commentary/admin/list.php',
        adminDetail: 'legal-commentary/admin/detail.php',
        adminSave: 'legal-commentary/admin/save.php',
        adminDelete: 'legal-commentary/admin/delete.php',
        adminCatalog: 'legal-commentary/admin/catalog.php',
        adminImport: 'legal-commentary/admin/import.php',
        adminSync: 'legal-commentary/admin/sync.php',
        adminUpdates: 'legal-commentary/admin/updates.php',
        adminGenerate: 'legal-commentary/admin/generate.php',
        adminBatchStart: 'legal-commentary/admin/batch-start.php',
        adminBatchStatus: 'legal-commentary/admin/batch-status.php',
        adminBatchRetry: 'legal-commentary/admin/batch-retry.php',
        adminBatchStop: 'legal-commentary/admin/batch-stop.php',
    },

    settings: {
        get: 'settings.php',
        update: 'admin/settings.php',
    },

    statistics: {
        user: 'statistics/user.php',
        question: 'statistics/question.php',
        platform: 'statistics/platform.php',
        xray: 'statistics/xray.php',
        bancaInfo: 'statistics/banca_info.php',
        studySession: 'statistics/study-session.php',
    },

    system: {
        logs: 'system/logs.php',
    },
} as const;

export default ENDPOINTS;
